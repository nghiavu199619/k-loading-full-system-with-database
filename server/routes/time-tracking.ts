import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { authorizeTimeTracking } from "../middleware/permissions";
import { z } from "zod";

const router = Router();

// ====================================================================
// ATTENDANCE ROUTES - Chấm công
// ====================================================================

// Get all attendance records for current user's employees
router.get("/attendance", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year, employeeId } = req.query;
    
    const records = await storage.getAttendanceRecords(userId, {
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
    });
    
    res.json(records);
  } catch (error) {
    console.error("❌ Error fetching attendance:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Clock in/out endpoint
router.post("/attendance/clock", requireAuth, async (req: Request, res: Response) => {
  try {
    const { type, location, notes } = req.body;
    const employeeId = req.user!.id;
    const userId = req.user!.createdBy || req.user!.id; // Use director's ID as owner
    
    const result = await storage.clockInOut(employeeId, userId, {
      type, // 'in' or 'out'
      location,
      notes,
      ipAddress: req.ip,
      deviceInfo: req.get('User-Agent'),
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Error clock in/out:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Update attendance record
router.put("/attendance/:id", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const userId = req.user!.id;
    
    const record = await storage.updateAttendanceRecord(id, userId, updates);
    res.json({ success: true, data: record });
  } catch (error) {
    console.error("❌ Error updating attendance:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// PAYROLL ROUTES - Tính lương
// ====================================================================

// Get payroll records
router.get("/payroll", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year, employeeId } = req.query;
    
    const records = await storage.getPayrollRecords(userId, {
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
    });
    
    res.json(records);
  } catch (error) {
    console.error("❌ Error fetching payroll:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Calculate payroll for month
router.post("/payroll/calculate", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const { month, year, employeeIds } = req.body;
    const userId = req.user!.id;
    
    const results = await storage.calculatePayroll(userId, { month, year, employeeIds });
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("❌ Error calculating payroll:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Approve payroll
router.put("/payroll/:id/approve", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { notes } = req.body;
    const userId = req.user!.id;
    
    const record = await storage.approvePayroll(id, userId, notes);
    res.json({ success: true, data: record });
  } catch (error) {
    console.error("❌ Error approving payroll:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// LEAVE REQUESTS ROUTES - Xin nghỉ
// ====================================================================

// Get leave requests
router.get("/leave-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, employeeId } = req.query;
    
    const requests = await storage.getLeaveRequests(userId, {
      status: status as string,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
    });
    
    res.json(requests);
  } catch (error) {
    console.error("❌ Error fetching leave requests:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Create leave request
router.post("/leave-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.id;
    const userId = req.user!.createdBy || req.user!.id;
    const requestData = { ...req.body, employeeId, userId };
    
    const request = await storage.createLeaveRequest(requestData);
    res.json({ success: true, data: request });
  } catch (error) {
    console.error("❌ Error creating leave request:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Approve/reject leave request
router.put("/leave-requests/:id", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, approvalNotes } = req.body;
    const approverId = req.user!.id;
    
    const request = await storage.approveLeaveRequest(id, approverId, status, approvalNotes);
    res.json({ success: true, data: request });
  } catch (error) {
    console.error("❌ Error approving leave request:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// PERFORMANCE METRICS ROUTES - Thống kê hiệu suất
// ====================================================================

// Get performance metrics
router.get("/performance", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year, employeeId } = req.query;
    
    const metrics = await storage.getPerformanceMetrics(userId, {
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
    });
    
    res.json(metrics);
  } catch (error) {
    console.error("❌ Error fetching performance metrics:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Update performance metrics
router.put("/performance/:id", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const userId = req.user!.id;
    
    const metric = await storage.updatePerformanceMetric(id, userId, updates);
    res.json({ success: true, data: metric });
  } catch (error) {
    console.error("❌ Error updating performance metric:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// SALARY BONUSES ROUTES - Thưởng lương
// ====================================================================

// Get salary bonuses
router.get("/bonuses", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year, bonusType, employeeId } = req.query;
    
    const bonuses = await storage.getSalaryBonuses(userId, {
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      bonusType: bonusType as string,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
    });
    
    res.json(bonuses);
  } catch (error) {
    console.error("❌ Error fetching salary bonuses:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Calculate bonuses
router.post("/bonuses/calculate", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const { month, year, bonusType } = req.body;
    const userId = req.user!.id;
    
    const results = await storage.calculateBonuses(userId, { month, year, bonusType });
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("❌ Error calculating bonuses:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// SHIFT SCHEDULES ROUTES - Lịch trực
// ====================================================================

// Get shift schedules
router.get("/shifts", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate, employeeId } = req.query;
    
    const shifts = await storage.getShiftSchedules(userId, {
      startDate: startDate as string,
      endDate: endDate as string,
      employeeId: employeeId ? parseInt(employeeId as string) : undefined,
    });
    
    res.json(shifts);
  } catch (error) {
    console.error("❌ Error fetching shift schedules:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Create shift schedule
router.post("/shifts", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const shiftData = req.body;
    const createdBy = req.user!.id;
    const userId = req.user!.id;
    
    const shift = await storage.createShiftSchedule({ ...shiftData, createdBy, userId });
    res.json({ success: true, data: shift });
  } catch (error) {
    console.error("❌ Error creating shift schedule:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// MONTHLY REVENUES ROUTES - Doanh thu tháng
// ====================================================================

// Get monthly revenues
router.get("/revenues", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { year } = req.query;
    
    const revenues = await storage.getMonthlyRevenues(userId, {
      year: year ? parseInt(year as string) : undefined,
    });
    
    res.json(revenues);
  } catch (error) {
    console.error("❌ Error fetching monthly revenues:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Update monthly revenue
router.put("/revenues/:id", requireAuth, authorizeTimeTracking("edit"), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const userId = req.user!.id;
    
    const revenue = await storage.updateMonthlyRevenue(id, userId, updates);
    res.json({ success: true, data: revenue });
  } catch (error) {
    console.error("❌ Error updating monthly revenue:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ====================================================================
// DASHBOARD STATS ROUTES - Thống kê tổng quan
// ====================================================================

// Get time tracking dashboard stats
router.get("/dashboard", requireAuth, authorizeTimeTracking("view"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { month, year } = req.query;
    
    const stats = await storage.getTimeTrackingDashboard(userId, {
      month: month ? parseInt(month as string) : new Date().getMonth() + 1,
      year: year ? parseInt(year as string) : new Date().getFullYear(),
    });
    
    res.json(stats);
  } catch (error) {
    console.error("❌ Error fetching time tracking dashboard:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

export default router;