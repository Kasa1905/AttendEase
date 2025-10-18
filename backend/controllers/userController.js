const { User } = require('../models');
const Joi = require('joi');
const { ROLES, ELEVATED_ROLES } = require('../constants/roles');

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  role: Joi.string().valid(ROLES.STUDENT, ROLES.CORE, ROLES.TEACHER)
});

module.exports = {
  async getAllUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, role } = req.query;
      const where = {};
      if (role) where.role = role;
      const users = await User.findAll({ where, attributes: { exclude: ['password'] }, offset: (page - 1) * limit, limit: parseInt(limit, 10) });
      res.json({ data: users });
    } catch (err) { next(err); }
  },

  async getUserById(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      // Ownership: allow if requesting own profile or allowed by RBAC middleware
      const requester = req.user;
      if (requester && requester.id === user.id) return res.json({ data: user });
      // else RBAC middleware should have allowed only authorized roles
      return res.json({ data: user });
    } catch (err) { next(err); }
  },

  async createUser(req, res, next) {
    try {
      const { error } = createUserSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });
      const user = await User.create(req.body);
      const safe = user.toJSON(); delete safe.password;
      res.status(201).json({ data: safe });
    } catch (err) { next(err); }
  },

  async updateUser(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const requester = req.user;
      const isOwner = requester && String(requester.id) === String(user.id);
      const isAdmin = requester && ELEVATED_ROLES.includes(requester.role);
      const ownerUpdatable = ['firstName', 'lastName', 'department', 'year', 'section'];
      const adminOnly = ['role', 'isActive'];
      const allowed = isAdmin ? [...ownerUpdatable, ...adminOnly] : isOwner ? ownerUpdatable : [];
      if (!allowed.length) return res.status(403).json({ error: 'Forbidden' });
      const payload = {};
      for (const k of allowed) if (k in req.body) payload[k] = req.body[k];
      await user.update(payload);
      const safe = user.toJSON(); delete safe.password;
      res.json({ data: safe });
    } catch (err) { next(err); }
  },

  async deleteUser(req, res, next) {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      await user.update({ isActive: false });
      res.json({ data: true });
    } catch (err) { next(err); }
  },

  async getUsersByRole(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const users = await User.findAll({ where: { role: req.params.role }, attributes: { exclude: ['password'] }, offset: (page - 1) * limit, limit: parseInt(limit, 10) });
      res.json({ data: users });
    } catch (err) { next(err); }
  }
};
