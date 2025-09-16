import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'k-loading-email-secret-32-characters-long!!';
const ALGORITHM = 'aes-256-cbc';

export interface ProviderConfig {
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
}

export class EmailEncryptionService {
  private static readonly IV_LENGTH = 16; // For AES, this is always 16

  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(EmailEncryptionService.IV_LENGTH);
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('❌ Email encryption error:', error);
      throw new Error('Failed to encrypt email credentials');
    }
  }

  static decrypt(encryptedText: string): string {
    try {
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedData = textParts.join(':');
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('❌ Email decryption error:', error);
      throw new Error('Failed to decrypt email credentials');
    }
  }

  static getProviderConfig(provider: string): ProviderConfig | null {
    const configs: Record<string, ProviderConfig> = {
      gmail: {
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          secure: true
        },
        smtp: {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true
        }
      },
      outlook: {
        imap: {
          host: 'outlook.office365.com',
          port: 993,
          secure: true
        },
        smtp: {
          host: 'smtp.office365.com',
          port: 587,
          secure: false // Uses STARTTLS
        }
      },
      yahoo: {
        imap: {
          host: 'imap.mail.yahoo.com',
          port: 993,
          secure: true
        },
        smtp: {
          host: 'smtp.mail.yahoo.com',
          port: 465,
          secure: true
        }
      }
    };

    return configs[provider] || null;
  }

  static validateConfiguration(): boolean {
    try {
      if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
        console.error('❌ EMAIL_ENCRYPTION_KEY must be at least 32 characters long');
        return false;
      }
      
      // Test encryption/decryption
      const testString = 'test-email-encryption';
      const encrypted = EmailEncryptionService.encrypt(testString);
      const decrypted = EmailEncryptionService.decrypt(encrypted);
      
      if (decrypted !== testString) {
        console.error('❌ Email encryption test failed');
        return false;
      }
      
      console.log('✅ Email encryption configuration validated');
      return true;
    } catch (error) {
      console.error('❌ Email encryption validation error:', error);
      return false;
    }
  }
}

// Validate configuration on import
EmailEncryptionService.validateConfiguration();