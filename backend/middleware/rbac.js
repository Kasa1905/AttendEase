const { ROLES, ELEVATED_ROLES } = require('../constants/roles');
const { DutySession } = require('../models');

function requireRole(roles = []) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden: insufficient role' });
    return next();
  };
}

function requireStudent() { return requireRole([ROLES.STUDENT]); }
function requireCoreTeam() { return requireRole([ROLES.CORE]); }
function requireTeacher() { return requireRole([ROLES.TEACHER]); }
function requireCoreTeamOrTeacher() { return requireRole(ELEVATED_ROLES); }

function requireOwnershipOrRole(roles = []) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const paramId = req.params.id || req.params.userId || req.body.userId;
      if (paramId && String(user.id) === String(paramId)) return next();
    if (roles.includes(user.role)) return next();
    return res.status(403).json({ error: 'Forbidden: not owner or authorized role' });
  };
}

function requireDutySessionOwnershipOrRole(roles = []) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const id = req.params.id || req.params.sessionId;
      if (!id) return res.status(400).json({ error: 'Session id required' });
      const session = await DutySession.findByPk(id);
      if (!session) return res.status(404).json({ error: 'Duty session not found' });
      if (String(session.userId) === String(user.id)) return next();
      if (roles.includes(user.role)) return next();
      return res.status(403).json({ error: 'Forbidden: not owner or authorized role' });
    } catch (err) { next(err); }
  };
}

module.exports = { requireRole, requireStudent, requireCoreTeam, requireTeacher, requireCoreTeamOrTeacher, requireOwnershipOrRole, requireDutySessionOwnershipOrRole };
