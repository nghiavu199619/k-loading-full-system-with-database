import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth } from '../middleware/auth-bridge';
import { EmailEncryptionService } from '../services/email-encryption';
import { EmailService } from '../services/email-service';
import type { EmailAccount } from '@shared/schema';

const router = Router();

// Email account schema for validation
const emailAccountSchema = z.object({
  accountName: z.string().min(1, 'Tên tài khoản không được trống'),
  emailAddress: z.string().email('Email không đúng định dạng'),
  provider: z.enum(['gmail', 'outlook', 'yahoo'], {
    errorMap: () => ({ message: 'Provider phải là gmail, outlook, hoặc yahoo' })
  }),
  password: z.string().min(1, 'Mật khẩu không được trống'),
  appPassword: z.string().optional(),
  autoRefresh: z.boolean().default(true),
  refreshInterval: z.number().default(60),
  isActive: z.boolean().default(true)
});

const sendEmailSchema = z.object({
  accountId: z.number(),
  to: z.string().email(),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional()
});

// GET /api/email-management - Lấy danh sách tài khoản email
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const accounts = await storage.getEmailAccountsByUser(userId);
    
    // Remove encrypted passwords from response
    const safeAccounts = accounts.map(account => ({
      ...account,
      encryptedPassword: '[HIDDEN]',
      encryptedAppPassword: '[HIDDEN]'
    }));
    
    res.json(safeAccounts);
  } catch (error) {
    console.error('❌ GET EMAIL ACCOUNTS ERROR:', error);
    res.status(500).json({ error: 'Không thể tải danh sách email' });
  }
});

// POST /api/email-management - Tạo tài khoản email mới
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = emailAccountSchema.parse(req.body);
    
    // Get provider configuration
    const providerConfig = EmailEncryptionService.getProviderConfig(validatedData.provider);
    if (!providerConfig) {
      return res.status(400).json({ error: 'Provider không được hỗ trợ' });
    }
    
    // Encrypt passwords
    const encryptedPassword = EmailEncryptionService.encrypt(validatedData.password);
    const encryptedAppPassword = validatedData.appPassword 
      ? EmailEncryptionService.encrypt(validatedData.appPassword)
      : null;
    
    // Create email account data
    const emailAccountData = {
      accountName: validatedData.accountName,
      emailAddress: validatedData.emailAddress,
      provider: validatedData.provider,
      encryptedPassword,
      encryptedAppPassword,
      imapHost: providerConfig.imap.host,
      imapPort: providerConfig.imap.port,
      imapSecure: providerConfig.imap.secure,
      smtpHost: providerConfig.smtp.host,
      smtpPort: providerConfig.smtp.port,
      smtpSecure: providerConfig.smtp.secure,
      autoRefresh: validatedData.autoRefresh,
      refreshInterval: validatedData.refreshInterval,
      isActive: validatedData.isActive,
      userId,
      createdBy: userId
    };
    
    const account = await storage.createEmailAccount(emailAccountData);
    
    // Test connection
    const imapTest = await EmailService.testImapConnection(account);
    const smtpTest = await EmailService.testSmtpConnection(account);
    
    if (!imapTest || !smtpTest) {
      // Delete the account if connection failed
      await storage.deleteEmailAccount(account.id);
      return res.status(400).json({ 
        error: 'Không thể kết nối email. Vui lòng kiểm tra thông tin đăng nhập.',
        details: {
          imap: imapTest ? 'OK' : 'Failed',
          smtp: smtpTest ? 'OK' : 'Failed'
        }
      });
    }
    
    // Initialize folders
    try {
      const folders = await EmailService.getFolders(account);
      for (const folderData of folders) {
        await storage.createEmailFolder({
          accountId: account.id,
          folderName: folderData.folderName,
          folderPath: folderData.folderPath,
          unreadCount: 0,
          totalCount: 0
        });
      }
    } catch (folderError) {
      console.warn('⚠️ Could not initialize folders:', folderError);
    }
    
    // Remove encrypted passwords from response
    const safeAccount = {
      ...account,
      encryptedPassword: '[HIDDEN]',
      encryptedAppPassword: '[HIDDEN]'
    };
    
    res.json(safeAccount);
  } catch (error) {
    console.error('❌ CREATE EMAIL ACCOUNT ERROR:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Dữ liệu không hợp lệ',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Không thể tạo tài khoản email' });
  }
});

// PUT /api/email-management/:id - Cập nhật tài khoản email
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Check if account belongs to user
    const existingAccount = await storage.getEmailAccountById(accountId);
    if (!existingAccount || existingAccount.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    const updateData = emailAccountSchema.partial().parse(req.body);
    
    // Encrypt new password if provided
    if (updateData.password) {
      (updateData as any).encryptedPassword = EmailEncryptionService.encrypt(updateData.password);
      delete updateData.password;
    }
    
    if (updateData.appPassword) {
      (updateData as any).encryptedAppPassword = EmailEncryptionService.encrypt(updateData.appPassword);
      delete updateData.appPassword;
    }
    
    const updatedAccount = await storage.updateEmailAccount(accountId, updateData);
    
    // Remove encrypted passwords from response
    const safeAccount = {
      ...updatedAccount,
      encryptedPassword: '[HIDDEN]',
      encryptedAppPassword: '[HIDDEN]'
    };
    
    res.json(safeAccount);
  } catch (error) {
    console.error('❌ UPDATE EMAIL ACCOUNT ERROR:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Dữ liệu không hợp lệ',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Không thể cập nhật tài khoản email' });
  }
});

// DELETE /api/email-management/:id - Xóa tài khoản email
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Check if account belongs to user
    const existingAccount = await storage.getEmailAccountById(accountId);
    if (!existingAccount || existingAccount.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    await storage.deleteEmailAccount(accountId);
    res.json({ message: 'Đã xóa tài khoản email thành công' });
  } catch (error) {
    console.error('❌ DELETE EMAIL ACCOUNT ERROR:', error);
    res.status(500).json({ error: 'Không thể xóa tài khoản email' });
  }
});

// GET /api/email-management/:id/folders - Lấy danh sách thư mục
router.get('/:id/folders', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Check if account belongs to user
    const account = await storage.getEmailAccountById(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    const folders = await storage.getEmailFoldersByAccount(accountId);
    res.json(folders);
  } catch (error) {
    console.error('❌ GET EMAIL FOLDERS ERROR:', error);
    res.status(500).json({ error: 'Không thể tải danh sách thư mục' });
  }
});

// GET /api/email-management/:id/folders/:folderId/messages - Lấy emails trong thư mục
router.get('/:id/folders/:folderId/messages', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const folderId = parseInt(req.params.folderId);
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Check if account belongs to user
    const account = await storage.getEmailAccountById(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    const messages = await storage.getEmailMessagesByFolder(folderId, limit, offset);
    res.json(messages);
  } catch (error) {
    console.error('❌ GET EMAIL MESSAGES ERROR:', error);
    res.status(500).json({ error: 'Không thể tải danh sách email' });
  }
});

// POST /api/email-management/:id/sync - Đồng bộ emails
router.post('/:id/sync', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Check if account belongs to user
    const account = await storage.getEmailAccountById(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    // Test connection first
    const connectionTest = await EmailService.testImapConnection(account);
    if (!connectionTest) {
      return res.status(400).json({ error: 'Không thể kết nối IMAP' });
    }
    
    // Get folders and sync
    const folders = await storage.getEmailFoldersByAccount(accountId);
    let totalSynced = 0;
    
    for (const folder of folders) {
      try {
        const emails = await EmailService.getEmails(account, folder.folderPath, 20);
        
        for (const emailData of emails) {
          emailData.accountId = accountId;
          emailData.folderId = folder.id;
          await storage.createEmailMessage(emailData);
          totalSynced++;
        }
        
        // Update folder counts
        await storage.updateEmailFolderCounts(folder.id, emails.filter(e => !e.isRead).length, emails.length);
      } catch (folderError) {
        console.warn(`⚠️ Could not sync folder ${folder.folderName}:`, folderError);
      }
    }
    
    // Update last sync time
    await storage.updateEmailAccountSync(accountId);
    
    res.json({ 
      message: `Đã đồng bộ ${totalSynced} email thành công`,
      totalSynced 
    });
  } catch (error) {
    console.error('❌ SYNC EMAIL ERROR:', error);
    res.status(500).json({ error: 'Không thể đồng bộ email' });
  }
});

// POST /api/email-management/:id/send - Gửi email
router.post('/:id/send', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user!.id;
    const emailData = sendEmailSchema.parse(req.body);
    
    // Check if account belongs to user
    const account = await storage.getEmailAccountById(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    const success = await EmailService.sendEmail(account, {
      to: emailData.to,
      cc: emailData.cc,
      bcc: emailData.bcc,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html
    });
    
    if (success) {
      res.json({ message: 'Email đã được gửi thành công' });
    } else {
      res.status(500).json({ error: 'Không thể gửi email' });
    }
  } catch (error) {
    console.error('❌ SEND EMAIL ERROR:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Dữ liệu không hợp lệ',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Không thể gửi email' });
  }
});

// POST /api/email-management/:id/test-connection - Kiểm tra kết nối
router.post('/:id/test-connection', requireAuth, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Check if account belongs to user
    const account = await storage.getEmailAccountById(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản email' });
    }
    
    const imapTest = await EmailService.testImapConnection(account);
    const smtpTest = await EmailService.testSmtpConnection(account);
    
    res.json({
      imap: imapTest ? 'OK' : 'Failed',
      smtp: smtpTest ? 'OK' : 'Failed',
      overall: imapTest && smtpTest ? 'OK' : 'Failed'
    });
  } catch (error) {
    console.error('❌ TEST CONNECTION ERROR:', error);
    res.status(500).json({ error: 'Không thể kiểm tra kết nối' });
  }
});

console.log('📧 EMAIL MANAGEMENT ROUTES LOADED!');

// Get all messages for email list tab
router.get('/all-messages', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const messages = await storage.getEmailAccounts(userId).then(async (accounts) => {
      const allMessages = [];
      for (const account of accounts) {
        const folders = await storage.getEmailFoldersByAccount(account.id);
        for (const folder of folders) {
          const folderMessages = await storage.getEmailMessagesByFolder(folder.id);
          allMessages.push(...folderMessages);
        }
      }
      return allMessages.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    });
    
    res.json(messages);
  } catch (error) {
    console.error('❌ Get all messages error:', error);
    res.status(500).json({ error: 'Failed to get all messages' });
  }
});

// Get all folders for all accounts
router.get('/all-folders', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const allFolders = [];
    const accounts = await storage.getEmailAccounts(userId);
    for (const account of accounts) {
      const folders = await storage.getEmailFoldersByAccount(account.id);
      allFolders.push(...folders);
    }
    
    res.json(allFolders);
  } catch (error) {
    console.error('❌ Get all folders error:', error);
    res.status(500).json({ error: 'Failed to get all folders' });
  }
});

export default router;