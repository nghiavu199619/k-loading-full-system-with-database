import Imap from 'imap';
import nodemailer from 'nodemailer';
import { EmailEncryptionService } from './email-encryption';

export interface EmailAccount {
  id: number;
  emailAddress: string;
  provider: string;
  encryptedPassword: string;
  encryptedAppPassword?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export interface EmailData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailMessage {
  messageId: string;
  subject?: string;
  fromAddress?: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  body?: string;
  htmlBody?: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  size?: number;
  receivedAt: Date;
  sentAt: Date;
}

export interface EmailFolder {
  folderName: string;
  folderPath: string;
}

export class EmailService {
  
  // Create IMAP configuration with proper TLS settings
  private static createImapConfig(account: EmailAccount, password: string) {
    return {
      user: account.emailAddress,
      password: password,
      host: account.imapHost,
      port: account.imapPort,
      tls: account.imapSecure,
      authTimeout: 15000,
      connTimeout: 15000,
      tlsOptions: {
        rejectUnauthorized: false, // Allow self-signed certificates
        secureProtocol: 'TLSv1_2_method'
      }
    };
  }
  
  // Test IMAP connection
  static async testImapConnection(account: EmailAccount): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const password = account.encryptedAppPassword 
          ? EmailEncryptionService.decrypt(account.encryptedAppPassword)
          : EmailEncryptionService.decrypt(account.encryptedPassword);

        const imapConfig = EmailService.createImapConfig(account, password);
        const imap = new Imap(imapConfig);

        const timeout = setTimeout(() => {
          imap.end();
          resolve(false);
        }, 15000);

        imap.once('ready', () => {
          clearTimeout(timeout);
          imap.end();
          resolve(true);
        });

        imap.once('error', (err: Error) => {
          clearTimeout(timeout);
          console.error('❌ IMAP connection error:', err.message);
          resolve(false);
        });

        imap.connect();
      } catch (error) {
        console.error('❌ IMAP test error:', error);
        resolve(false);
      }
    });
  }

  // Test SMTP connection
  static async testSmtpConnection(account: EmailAccount): Promise<boolean> {
    try {
      const password = account.encryptedAppPassword 
        ? EmailEncryptionService.decrypt(account.encryptedAppPassword)
        : EmailEncryptionService.decrypt(account.encryptedPassword);

      const transporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        auth: {
          user: account.emailAddress,
          pass: password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });

      await transporter.verify();
      return true;
    } catch (error) {
      console.error('❌ SMTP test error:', error);
      return false;
    }
  }

  // Get email folders
  static async getFolders(account: EmailAccount): Promise<EmailFolder[]> {
    return new Promise((resolve, reject) => {
      try {
        const password = account.encryptedAppPassword 
          ? EmailEncryptionService.decrypt(account.encryptedAppPassword)
          : EmailEncryptionService.decrypt(account.encryptedPassword);

        const imapConfig = {
          user: account.emailAddress,
          password: password,
          host: account.imapHost,
          port: account.imapPort,
          tls: account.imapSecure,
          authTimeout: 15000,
          connTimeout: 15000,
          tlsOptions: {
            rejectUnauthorized: false // Allow self-signed certificates
          }
        };

        const imap = new Imap(imapConfig);
        const folders: EmailFolder[] = [];

        const timeout = setTimeout(() => {
          imap.end();
          reject(new Error('IMAP connection timeout'));
        }, 20000);

        imap.once('ready', () => {
          imap.getBoxes((err: Error, boxes: any) => {
            clearTimeout(timeout);
            
            if (err) {
              imap.end();
              return reject(err);
            }

            const extractFolders = (boxObj: any, path = '') => {
              for (const [name, box] of Object.entries(boxObj)) {
                if (name === 'attribs' || name === 'delimiter' || name === 'children') continue;
                
                const fullPath = path ? `${path}${box.delimiter || '/'}${name}` : name;
                
                folders.push({
                  folderName: name,
                  folderPath: fullPath
                });

                if (box.children) {
                  extractFolders(box.children, fullPath);
                }
              }
            };

            extractFolders(boxes);
            imap.end();
            resolve(folders);
          });
        });

        imap.once('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });

        imap.connect();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get emails from a folder
  static async getEmails(account: EmailAccount, folderPath: string, limit = 20): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      try {
        const password = account.encryptedAppPassword 
          ? EmailEncryptionService.decrypt(account.encryptedAppPassword)
          : EmailEncryptionService.decrypt(account.encryptedPassword);

        const imapConfig = EmailService.createImapConfig(account, password);
        const imap = new Imap(imapConfig);
        const emails: EmailMessage[] = [];

        const timeout = setTimeout(() => {
          imap.end();
          reject(new Error('IMAP connection timeout'));
        }, 30000);

        imap.once('ready', () => {
          imap.openBox(folderPath, true, (err: Error, box: any) => {
            if (err) {
              clearTimeout(timeout);
              imap.end();
              return reject(err);
            }

            if (box.messages.total === 0) {
              clearTimeout(timeout);
              imap.end();
              return resolve([]);
            }

            const range = `${Math.max(1, box.messages.total - limit + 1)}:${box.messages.total}`;
            const fetch = imap.seq.fetch(range, {
              bodies: ['HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE)', 'TEXT'],
              struct: true
            });

            fetch.on('message', (msg: any, seqno: number) => {
              const email: Partial<EmailMessage> = {
                messageId: seqno.toString(),
                toAddresses: [],
                isRead: false,
                isFlagged: false,
                hasAttachments: false,
                receivedAt: new Date(),
                sentAt: new Date()
              };

              msg.on('body', (stream: any, info: any) => {
                let buffer = '';
                stream.on('data', (chunk: any) => {
                  buffer += chunk.toString('utf8');
                });
                stream.once('end', () => {
                  if (info.which === 'TEXT') {
                    email.body = buffer;
                  } else {
                    // Parse headers
                    const lines = buffer.split('\r\n');
                    lines.forEach(line => {
                      const [key, ...valueParts] = line.split(':');
                      const value = valueParts.join(':').trim();
                      
                      switch (key?.toLowerCase()) {
                        case 'from':
                          const fromMatch = value.match(/(.+?)\s*<(.+)>/) || value.match(/(.+)/);
                          if (fromMatch) {
                            email.fromName = fromMatch[1]?.replace(/"/g, '').trim();
                            email.fromAddress = fromMatch[2] || fromMatch[1];
                          }
                          break;
                        case 'to':
                          email.toAddresses = value.split(',').map(addr => addr.trim());
                          break;
                        case 'cc':
                          email.ccAddresses = value.split(',').map(addr => addr.trim());
                          break;
                        case 'subject':
                          email.subject = value;
                          break;
                        case 'date':
                          email.sentAt = new Date(value);
                          email.receivedAt = new Date(value);
                          break;
                      }
                    });
                  }
                });
              });

              msg.once('attributes', (attrs: any) => {
                email.isRead = !attrs.flags.includes('\\Seen');
                email.isFlagged = attrs.flags.includes('\\Flagged');
                email.size = attrs.size;
              });

              msg.once('end', () => {
                emails.push(email as EmailMessage);
              });
            });

            fetch.once('error', (err: Error) => {
              clearTimeout(timeout);
              imap.end();
              reject(err);
            });

            fetch.once('end', () => {
              clearTimeout(timeout);
              imap.end();
              resolve(emails.reverse()); // Most recent first
            });
          });
        });

        imap.once('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });

        imap.connect();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Send email
  static async sendEmail(account: EmailAccount, emailData: EmailData): Promise<boolean> {
    try {
      const password = account.encryptedAppPassword 
        ? EmailEncryptionService.decrypt(account.encryptedAppPassword)
        : EmailEncryptionService.decrypt(account.encryptedPassword);

      const transporter = nodemailer.createTransporter({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        auth: {
          user: account.emailAddress,
          pass: password,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
      });

      const mailOptions = {
        from: account.emailAddress,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('❌ Send email error:', error);
      return false;
    }
  }
}