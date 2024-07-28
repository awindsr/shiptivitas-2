import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  return res.status(200).send({ 'message': 'SHIPTIVITY API. Read documentation to see API docs' });
});

const db = new Database('./clients.db');

const closeDb = () => db.close();
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);

const validateId = (id) => {
  if (Number.isNaN(id)) {
    return {
      valid: false,
      messageObj: {
        'message': 'Invalid id provided.',
        'long_message': 'Id can only be integer.',
      },
    };
  }
  const client = db.prepare('select * from clients where id = ? limit 1').get(id);
  if (!client) {
    return {
      valid: false,
      messageObj: {
        'message': 'Invalid id provided.',
        'long_message': 'Cannot find client with that id.',
      },
    };
  }
  return {
    valid: true,
  };
};

const validatePriority = (priority) => {
  if (Number.isNaN(priority)) {
    return {
      valid: false,
      messageObj: {
        'message': 'Invalid priority provided.',
        'long_message': 'Priority can only be positive integer.',
      },
    };
  }
  return {
    valid: true,
  };
};

app.get('/api/v1/clients', (req, res) => {
  const status = req.query.status;
  if (status) {
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    const clients = db.prepare('select * from clients where status = ?').all(status);
    return res.status(200).send(clients);
  }
  const statement = db.prepare('select * from clients');
  const clients = statement.all();
  return res.status(200).send(clients);
});

app.get('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    return res.status(400).send(messageObj);
  }
  return res.status(200).send(db.prepare('select * from clients where id = ?').get(id));
});

app.put('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    return res.status(400).send(messageObj);
  }

  let { status, priority } = req.body;

  if (priority !== undefined) {
    const { valid, messageObj } = validatePriority(priority);
    if (!valid) {
      return res.status(400).send(messageObj);
    }
  }

  const client = db.prepare('select * from clients where id = ?').get(id);

  if (status) {
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    db.prepare('update clients set status = ? where id = ?').run(status, id);
  }

  if (priority !== undefined) {
    db.prepare('update clients set priority = ? where id = ?').run(priority, id);

    const clientsInSameStatus = db.prepare('select * from clients where status = ? order by priority').all(client.status);
    clientsInSameStatus.forEach((client, index) => {
      db.prepare('update clients set priority = ? where id = ?').run(index + 1, client.id);
    });
  }

  const updatedClients = db.prepare('select * from clients').all();

  return res.status(200).send(updatedClients);
});

app.listen(3001, () => {
  console.log('app running on port ', 3001);
});
