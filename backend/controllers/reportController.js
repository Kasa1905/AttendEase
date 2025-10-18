const reportService = require('../services/reportService');
const Joi = require('joi');
const { generateAttendancePDF, generateDutyLogPDF, generatePenaltyPDF, generateDailySummaryPDF } = require('../utils/pdfUtils');
const { generateAttendanceExcel, generateDutyLogExcel, generatePenaltyExcel, generateDailySummaryExcel } = require('../utils/excelUtils');
const { Parser } = require('json2csv');

// Validation schemas
const reportFiltersSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  userId: Joi.string().guid().optional(),
  status: Joi.alternatives().try(
    Joi.string().valid('present_in_class', 'on_club_duty', 'absent'),
    Joi.array().items(Joi.string().valid('present_in_class', 'on_club_duty', 'absent'))
  ).optional(),
  approvalStatus: Joi.string().valid('approved', 'rejected', 'pending').optional(),
  eventId: Joi.string().guid().optional(),
  isActive: Joi.boolean().optional(),
  reason: Joi.alternatives().try(
    Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other'),
    Joi.array().items(Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other'))
  ).optional(),
  severity: Joi.alternatives().try(
    Joi.string().valid('warning', 'minor', 'major'),
    Joi.array().items(Joi.string().valid('warning', 'minor', 'major'))
  ).optional(),
  role: Joi.string().valid('student', 'teacher', 'core_team').optional()
});

const exportFormatSchema = Joi.object({
  format: Joi.string().valid('pdf', 'excel', 'csv').required(),
  reportType: Joi.string().valid('attendance', 'duty', 'penalty', 'daily').required()
});

module.exports = {
  /**
   * Generate attendance summary reports
   */
  async generateAttendanceReport(req, res, next) {
    try {
      const { error: filterError } = reportFiltersSchema.validate(req.query);
      if (filterError) return res.status(400).json({ error: filterError.details[0].message });

      const filters = req.query;
      const validation = reportService.validateReportFilters(filters);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      const reportData = await reportService.generateAttendanceSummaryData(filters);

      res.json({
        success: true,
        data: reportData
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Generate duty session reports
   */
  async generateDutyLogReport(req, res, next) {
    try {
      const { error: filterError } = reportFiltersSchema.validate(req.query);
      if (filterError) return res.status(400).json({ error: filterError.details[0].message });

      const filters = req.query;
      const validation = reportService.validateReportFilters(filters);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      const reportData = await reportService.generateDutyLogData(filters);

      res.json({
        success: true,
        data: reportData
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Generate penalty reports
   */
  async generatePenaltyReport(req, res, next) {
    try {
      const { error: filterError } = reportFiltersSchema.validate(req.query);
      if (filterError) return res.status(400).json({ error: filterError.details[0].message });

      const filters = req.query;
      const validation = reportService.validateReportFilters(filters);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      const reportData = await reportService.generatePenaltyReportData(filters);

      res.json({
        success: true,
        data: reportData
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Generate daily summary reports for teachers
   */
  async generateDailySummaryReport(req, res, next) {
    try {
      const { date } = req.params;
      const filters = req.query;

      const reportData = await reportService.generateDailySummaryData(date, filters);

      res.json({
        success: true,
        data: reportData
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Generate member activity reports for core team
   */
  async generateMemberActivityReport(req, res, next) {
    try {
      const { error: filterError } = reportFiltersSchema.validate(req.query);
      if (filterError) return res.status(400).json({ error: filterError.details[0].message });

      const filters = req.query;
      const validation = reportService.validateReportFilters(filters);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      const reportData = await reportService.generateMemberActivityData(filters);

      res.json({
        success: true,
        data: reportData
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export any report as PDF
   */
  async exportToPDF(req, res, next) {
    try {
      const { error } = exportFormatSchema.validate({ ...req.body, format: 'pdf' });
      if (error) return res.status(400).json({ error: error.details[0].message });

      const { reportType, filters = {} } = req.body;

      let reportData;
      switch (reportType) {
        case 'attendance':
          reportData = await reportService.generateAttendanceSummaryData(filters);
          break;
        case 'duty':
          reportData = await reportService.generateDutyLogData(filters);
          break;
        case 'penalty':
          reportData = await reportService.generatePenaltyReportData(filters);
          break;
        case 'daily':
          reportData = await reportService.generateDailySummaryData(filters.date, filters);
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      const pdfRaw = await generatePDF(reportData, reportType, filters);
      const pdfBuffer = Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);

      const fileName = `club-attendance-${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export any report as Excel
   */
  async exportToExcel(req, res, next) {
    try {
      const { error } = exportFormatSchema.validate({ ...req.body, format: 'excel' });
      if (error) return res.status(400).json({ error: error.details[0].message });

      const { reportType, filters = {} } = req.body;

      let reportData;
      switch (reportType) {
        case 'attendance':
          reportData = await reportService.generateAttendanceSummaryData(filters);
          break;
        case 'duty':
          reportData = await reportService.generateDutyLogData(filters);
          break;
        case 'penalty':
          reportData = await reportService.generatePenaltyReportData(filters);
          break;
        case 'daily':
          reportData = await reportService.generateDailySummaryData(filters.date, filters);
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      const excelBuffer = await generateExcel(reportData, reportType, filters);

      const fileName = `club-attendance-${reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(excelBuffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export any report as CSV
   */
  async exportToCSV(req, res, next) {
    try {
      const { error } = exportFormatSchema.validate({ ...req.body, format: 'csv' });
      if (error) return res.status(400).json({ error: error.details[0].message });

      const { reportType, filters = {} } = req.body;

      if (reportType === 'daily') {
        return res.status(400).json({ error: 'CSV export is not supported for daily summary reports.' });
      }

      let reportData;
      switch (reportType) {
        case 'attendance':
          reportData = await reportService.generateAttendanceSummaryData(filters);
          break;
        case 'duty':
          reportData = await reportService.generateDutyLogData(filters);
          break;
        case 'penalty':
          reportData = await reportService.generatePenaltyReportData(filters);
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      const csvData = reportService.formatReportData(reportData.data, reportType);
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(csvData);

      const fileName = `club-attendance-${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get report preview data before export
   */
  async getReportPreview(req, res, next) {
    try {
      const { error } = Joi.object({
        reportType: Joi.string().valid('attendance', 'duty', 'penalty', 'daily').required(),
        filters: reportFiltersSchema.optional(),
        limit: Joi.number().integer().min(1).max(100).default(50)
      }).validate(req.body);

      if (error) return res.status(400).json({ error: error.details[0].message });

      const { reportType, filters = {}, limit } = req.body;

      let reportData;
      switch (reportType) {
        case 'attendance':
          reportData = await reportService.generateAttendanceSummaryData(filters);
          break;
        case 'duty':
          reportData = await reportService.generateDutyLogData(filters);
          break;
        case 'penalty':
          reportData = await reportService.generatePenaltyReportData(filters);
          break;
        case 'daily':
          reportData = await reportService.generateDailySummaryData(filters.date, filters);
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      // Limit preview data
      const previewData = {
        ...reportData,
        data: reportData.data.slice(0, limit)
      };

      res.json({
        success: true,
        data: previewData,
        hasMore: reportData.data.length > limit
      });
    } catch (err) {
      next(err);
    }
  }
};

// Helper functions for export generation
async function generatePDF(reportData, reportType, filters) {
  switch (reportType) {
    case 'attendance':
      return await generateAttendancePDF(reportData, filters);
    case 'duty':
      return await generateDutyLogPDF(reportData, filters);
    case 'penalty':
      return await generatePenaltyPDF(reportData, filters);
    case 'daily':
      return await generateDailySummaryPDF(reportData, filters);
    default:
      throw new Error('Unsupported report type for PDF generation');
  }
}

async function generateExcel(reportData, reportType, filters) {
  switch (reportType) {
    case 'attendance':
      return await generateAttendanceExcel(reportData, filters);
    case 'duty':
      return await generateDutyLogExcel(reportData, filters);
    case 'penalty':
      return await generatePenaltyExcel(reportData, filters);
    case 'daily':
      return await generateDailySummaryExcel(reportData, filters);
    default:
      throw new Error('Unsupported report type for Excel generation');
  }
}