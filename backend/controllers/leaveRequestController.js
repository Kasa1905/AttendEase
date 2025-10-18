const { LeaveRequest, User } = require('../models');
const { Op } = require('sequelize');
const leaveUtils = require('../utils/leaveRequestUtils');
const notificationService = require('../services/notificationService');
const { ROLES } = require('../constants/roles');

async function submitRequest(req, res) {
  try {
    const { requestType, requestDate, reason } = req.body;
    const userId = req.user.id;

    // basic validation
    if (!['leave', 'club_duty'].includes(requestType)) return res.status(400).json({ error: 'Invalid request type' });
    if (!requestDate) return res.status(400).json({ error: 'requestDate required' });
    if (!reason || reason.length < 10) return res.status(400).json({ error: 'Provide a reason (min 10 chars)' });

    // validate request date (today or future)
    if (!leaveUtils.validateRequestDate(requestDate)) return res.status(400).json({ error: 'requestDate must be today or in the future' });

    // 9 AM submission rule
    const submittedAt = new Date();
    if (!leaveUtils.validateSubmissionTime(submittedAt, requestDate)) {
      return res.status(400).json({ error: 'Requests must be submitted before 9:00 AM on the request date' });
    }

    // duplicate prevention (range-based to avoid timezone issues)
    const conflict = await leaveUtils.checkRequestConflicts(LeaveRequest, userId, requestDate);
    if (conflict) return res.status(409).json({ error: 'A request for this date already exists' });

    const request = await LeaveRequest.create({ userId, requestType, requestDate, reason, status: 'pending', submittedAt });

    // notify core team role about new request
    try {
      await notificationService.sendRoleNotification(ROLES.CORE, 'generic', 'New Leave Request', `New request from user ${userId} for ${requestDate}`, { requestId: request.id });
    } catch (e) { console.error('notify core', e); }

    return res.status(201).json(request);
  } catch (err) {
    console.error('submitRequest', err);
    return res.status(500).json({ error: 'Failed to submit request' });
  }
}

async function getMyRequests(req, res) {
  try {
    const userId = req.user.id;
    const where = { userId };
    if (req.query.status) where.status = req.query.status;
    const list = await LeaveRequest.findAll({ where, order: [['requestDate', 'DESC']] });
    return res.json(list);
  } catch (err) {
    console.error('getMyRequests', err);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
}

async function getPendingRequests(req, res) {
  try {
    const list = await LeaveRequest.findAll({ where: { status: 'pending' }, include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }], order: [['requestDate', 'ASC']] });
    return res.json(list);
  } catch (err) {
    console.error('getPendingRequests', err);
    return res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
}

async function getAllRequests(req, res) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.fromDate && req.query.toDate) where.requestDate = { [Op.between]: [req.query.fromDate, req.query.toDate] };
    // pagination
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize || '20', 10)));
    const offset = (page - 1) * pageSize;
    const { count, rows } = await LeaveRequest.findAndCountAll({ where, include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }], order: [['requestDate', 'DESC']], limit: pageSize, offset });
    return res.json({ data: rows, page, pageSize, total: count });
  } catch (err) {
    console.error('getAllRequests', err);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
}

async function approveRequest(req, res) {
  try {
    const id = req.params.id;
    const approverId = req.user.id;
    const r = await LeaveRequest.findByPk(id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be approved' });
    r.status = 'approved';
    r.approvedBy = approverId;
    r.approvedAt = new Date();
    await r.save();
    // notify the requester about approval
    try {
      if (notificationService.sendRequestApprovalNotification) await notificationService.sendRequestApprovalNotification(r.userId, r);
      else await notificationService.sendNotification(r.userId, 'request_approved', 'Request Approved', `Your request for ${r.requestDate} was approved.`, { requestId: r.id });
    } catch (e) { console.error('notify approve', e); }
    return res.json(r);
  } catch (err) {
    console.error('approveRequest', err);
    return res.status(500).json({ error: 'Failed to approve request' });
  }
}

async function rejectRequest(req, res) {
  try {
    const id = req.params.id;
    const { rejectionReason } = req.body;
    if (!rejectionReason || rejectionReason.length < 5) return res.status(400).json({ error: 'Provide rejectionReason (min 5 chars)' });
    const approverId = req.user.id;
    const r = await LeaveRequest.findByPk(id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be rejected' });
    r.status = 'rejected';
    r.rejectionReason = rejectionReason;
    r.approvedBy = approverId;
    r.approvedAt = new Date();
    await r.save();
    // notify the requester about rejection
    try {
      if (notificationService.sendRequestRejectionNotification) await notificationService.sendRequestRejectionNotification(r.userId, r);
      else await notificationService.sendNotification(r.userId, 'request_rejected', 'Request Rejected', `Your request for ${r.requestDate} was rejected: ${r.rejectionReason}`, { requestId: r.id });
    } catch (e) { console.error('notify reject', e); }
    return res.json(r);
  } catch (err) {
    console.error('rejectRequest', err);
    return res.status(500).json({ error: 'Failed to reject request' });
  }
}

async function bulkApproveRequests(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids array required' });
    const t = await LeaveRequest.sequelize.transaction();
    try {
      const approverId = req.user.id;
      const updated = [];
      for (const id of ids) {
        const r = await LeaveRequest.findByPk(id, { transaction: t });
        if (r && r.status === 'pending') {
          r.status = 'approved'; r.approvedBy = approverId; r.approvedAt = new Date(); await r.save({ transaction: t }); updated.push(r);
        }
      }
      await t.commit();
      // notify all updated users
      try {
        for (const u of updated) {
          if (notificationService.sendRequestApprovalNotification) await notificationService.sendRequestApprovalNotification(u.userId, u);
          else await notificationService.sendNotification(u.userId, 'request_approved', 'Request Approved', `Your request for ${u.requestDate} was approved.`, { requestId: u.id });
        }
      } catch (e) { console.error('bulk notify', e); }
      return res.json({ updatedCount: updated.length, updated });
    } catch (e) { await t.rollback(); throw e; }
  } catch (err) {
    console.error('bulkApproveRequests', err);
    return res.status(500).json({ error: 'Failed to bulk approve' });
  }
}

async function getRequestStats(req, res) {
  try {
    const total = await LeaveRequest.count();
    const pending = await LeaveRequest.count({ where: { status: 'pending' } });
    const approved = await LeaveRequest.count({ where: { status: 'approved' } });
    const rejected = await LeaveRequest.count({ where: { status: 'rejected' } });
    return res.json({ total, pending, approved, rejected });
  } catch (err) {
    console.error('getRequestStats', err);
    return res.status(500).json({ error: 'Failed to compute stats' });
  }
}

async function updateRequest(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    const r = await LeaveRequest.findByPk(id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.userId !== userId) return res.status(403).json({ error: 'Not authorized' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be updated' });
    const { requestDate, reason } = req.body;
    // validate provided fields
    if (requestDate) {
      if (!leaveUtils.validateRequestDate(requestDate)) return res.status(400).json({ error: 'requestDate must be today or in the future' });
      // enforce 9 AM rule relative to original submittedAt
      if (!leaveUtils.validateSubmissionTime(r.submittedAt || r.createdAt || new Date(), requestDate)) {
        return res.status(400).json({ error: 'Original submission time violates 9:00 AM rule for the new date' });
      }
      // duplicate check excluding this id
      const conflict = await leaveUtils.checkRequestConflicts(LeaveRequest, userId, requestDate, id);
      if (conflict) return res.status(409).json({ error: 'A request for this date already exists' });
      r.requestDate = requestDate;
    }
    if (reason) {
      if (reason.length < 10) return res.status(400).json({ error: 'Provide a reason (min 10 chars)' });
      r.reason = reason;
    }
    await r.save();
    return res.json(r);
  } catch (err) {
    console.error('updateRequest', err);
    return res.status(500).json({ error: 'Failed to update request' });
  }
}

async function deleteRequest(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    const r = await LeaveRequest.findByPk(id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.userId !== userId) return res.status(403).json({ error: 'Not authorized' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be deleted' });
    await r.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteRequest', err);
    return res.status(500).json({ error: 'Failed to delete request' });
  }
}

module.exports = {
  submitRequest,
  getMyRequests,
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  bulkApproveRequests,
  getRequestStats,
  updateRequest,
  deleteRequest,
};
