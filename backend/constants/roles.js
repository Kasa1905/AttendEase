exports.ROLES = {
  STUDENT: 'student',
  CORE: 'core_team',
  TEACHER: 'teacher'
};
const ROLES = {
  STUDENT: 'student',
  CORE: 'core_team',
  TEACHER: 'teacher'
};

const ELEVATED_ROLES = [ROLES.CORE, ROLES.TEACHER];

module.exports = { ROLES, ELEVATED_ROLES };
