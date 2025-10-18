'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { ROLES } = require('../../constants/roles');

/**
 * User Acceptance Testing (UAT) seed file
 * Creates a set of test users with different roles for UAT environment
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('UAT_Password123!', salt);
    
    // Create date variables for consistent timestamps
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Create a set of test users with different roles
    return queryInterface.bulkInsert('Users', [
      // Admin user
      {
        id: uuidv4(),
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.ADMIN,
        phoneNumber: '+1234567890',
        studentId: 'A00000001',
        isActive: true,
        dutyEligible: false,
        attendanceRate: 100,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Manager user
      {
        id: uuidv4(),
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.MANAGER,
        phoneNumber: '+1234567891',
        studentId: 'A00000002',
        isActive: true,
        dutyEligible: true,
        attendanceRate: 95,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Member user with good attendance
      {
        id: uuidv4(),
        firstName: 'Active',
        lastName: 'Member',
        email: 'active.member.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.MEMBER,
        phoneNumber: '+1234567892',
        studentId: 'A00000003',
        isActive: true,
        dutyEligible: true,
        attendanceRate: 92,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Member user with average attendance
      {
        id: uuidv4(),
        firstName: 'Regular',
        lastName: 'Member',
        email: 'regular.member.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.MEMBER,
        phoneNumber: '+1234567893',
        studentId: 'A00000004',
        isActive: true,
        dutyEligible: true,
        attendanceRate: 75,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Member user with poor attendance
      {
        id: uuidv4(),
        firstName: 'Irregular',
        lastName: 'Member',
        email: 'irregular.member.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.MEMBER,
        phoneNumber: '+1234567894',
        studentId: 'A00000005',
        isActive: true,
        dutyEligible: false,
        attendanceRate: 45,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Suspended member
      {
        id: uuidv4(),
        firstName: 'Suspended',
        lastName: 'Member',
        email: 'suspended.member.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.MEMBER,
        phoneNumber: '+1234567895',
        studentId: 'A00000006',
        isActive: true,
        dutyEligible: false,
        attendanceRate: 30,
        suspensionReason: 'Multiple missed events without notice',
        suspendedUntil: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Inactive member
      {
        id: uuidv4(),
        firstName: 'Inactive',
        lastName: 'Member',
        email: 'inactive.member.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.MEMBER,
        phoneNumber: '+1234567896',
        studentId: 'A00000007',
        isActive: false,
        dutyEligible: false,
        attendanceRate: 0,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      },
      
      // Guest user
      {
        id: uuidv4(),
        firstName: 'Guest',
        lastName: 'User',
        email: 'guest.uat@clubattendance.example',
        password: hashedPassword,
        role: ROLES.GUEST,
        phoneNumber: '+1234567897',
        studentId: 'A00000008',
        isActive: true,
        dutyEligible: false,
        attendanceRate: 0,
        suspensionReason: null,
        suspendedUntil: null,
        createdAt: oneWeekAgo,
        updatedAt: now
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Users', {
      email: {
        [Sequelize.Op.like]: '%.uat@clubattendance.example'
      }
    }, {});
  }
};