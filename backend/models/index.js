const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const db = { sequelize, Sequelize: require('sequelize') };

const files = fs.readdirSync(__dirname).filter(f => f !== 'index.js' && f.endsWith('.js'));

for (const file of files) {
  const model = require(path.join(__dirname, file))(sequelize, DataTypes);
  db[model.name] = model;
}

// Setup associations if models define associate
Object.keys(db).forEach((modelName) => {
  if (db[modelName] && db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
