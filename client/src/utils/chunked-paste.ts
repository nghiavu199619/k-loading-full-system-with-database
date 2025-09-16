/**
 * Google Sheets-style Chunked Paste Utility
 * Handles large paste operations (1,000-10,000 rows) with chunked processing
 */

interface ChunkConfig {
  chunkSize: number; // Default 200 rows per chunk
  maxConcurrent: number; // Max 3 concurrent requests
  sessionId: string;
}

interface PasteData {
  accountId?: string;
  name?: string;
  status?: string;
  source?: string;
  [key: string]: any;
}

interface ChunkedPasteResponse {
  success: boolean;
  totalRows: number;
  chunksProcessed: number;
  message: string;
}

/**
 * Split large array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Create optimistic temp IDs for paste data
 */
export function createTempIds(count: number, baseTimestamp: number = Date.now()): string[] {
  return Array.from({ length: count }, (_, i) => 
    `temp-${baseTimestamp}-${i}-${Math.random().toString(36).substring(2, 11)}`
  );
}

/**
 * Process chunked paste operation with Google Sheets-style performance
 */
export async function processChunkedPaste(
  pasteData: PasteData[],
  apiRequest: (method: string, url: string, data: any) => Promise<any>,
  config: ChunkConfig
): Promise<ChunkedPasteResponse> {
  const { chunkSize, maxConcurrent, sessionId } = config;
  const chunks = chunkArray(pasteData, chunkSize);
  const totalChunks = chunks.length;
  
  console.log(`🚀 GOOGLE SHEETS PASTE: Processing ${pasteData.length} rows in ${totalChunks} chunks`);
  console.log(`📦 CHUNK CONFIG: ${chunkSize} rows/chunk, max ${maxConcurrent} concurrent`);

  // Process chunks with concurrency control
  let processedChunks = 0;
  const results: any[] = [];

  for (let i = 0; i < chunks.length; i += maxConcurrent) {
    // Process up to maxConcurrent chunks in parallel
    const currentBatch = chunks.slice(i, i + maxConcurrent);
    const batchPromises = currentBatch.map(async (chunk, batchIndex) => {
      const chunkIndex = i + batchIndex;
      const temps = createTempIds(chunk.length);
      
      console.log(`📤 SENDING CHUNK ${chunkIndex + 1}/${totalChunks}: ${chunk.length} rows`);
      
      const requestData = {
        count: chunk.length,
        temps,
        defaultValues: chunk, // Array of individual row data
        sessionId,
        isChunked: true,
        chunkIndex,
        totalChunks
      };

      try {
        const response = await apiRequest('POST', '/api/ad-accounts/bulk', requestData);
        console.log(`✅ CHUNK ${chunkIndex + 1} SUCCESS: ${response.rows?.length || chunk.length} rows created`);
        return response;
      } catch (error) {
        console.error(`❌ CHUNK ${chunkIndex + 1} FAILED:`, error);
        throw error;
      }
    });

    // Wait for current batch to complete
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      processedChunks += currentBatch.length;
      
      console.log(`🎯 BATCH COMPLETE: ${processedChunks}/${totalChunks} chunks processed`);
      
      // Small delay between batches to prevent server overload
      if (i + maxConcurrent < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ BATCH FAILED at chunk ${i + 1}-${i + maxConcurrent}:`, error);
      throw error;
    }
  }

  const totalRowsCreated = results.reduce((sum, result) => sum + (result.rows?.length || 0), 0);
  
  console.log(`🏆 CHUNKED PASTE COMPLETE: ${totalRowsCreated} total rows created in ${processedChunks} chunks`);
  
  return {
    success: true,
    totalRows: totalRowsCreated,
    chunksProcessed: processedChunks,
    message: `Successfully pasted ${totalRowsCreated} rows using Google Sheets-style chunked processing`
  };
}

/**
 * Parse paste data from clipboard or manual input
 * Supports common formats like TSV, CSV, or JSON
 */
export function parsePasteData(rawData: string, format: 'tsv' | 'csv' | 'json' = 'tsv'): PasteData[] {
  if (!rawData.trim()) return [];

  try {
    if (format === 'json') {
      return JSON.parse(rawData);
    }

    const delimiter = format === 'csv' ? ',' : '\t';
    const lines = rawData.trim().split('\n');
    const headers = lines[0].split(delimiter);
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(delimiter);
      const rowData: PasteData = {};
      
      headers.forEach((header, i) => {
        const cleanHeader = header.trim().toLowerCase();
        const value = values[i]?.trim() || '';
        
        // Map common headers to our schema
        switch (cleanHeader) {
          case 'id':
          case 'account_id':
          case 'accountid':
            rowData.accountId = value || `Tài khoản ${index + 1}`;
            break;
          case 'name':
          case 'account_name':
          case 'tên':
            rowData.name = value;
            break;
          case 'status':
          case 'trạng thái':
            rowData.status = value || ''; // ✅ REMOVED "Hoạt động" default - empty by default
            break;
          case 'source':
          case 'nguồn':
            rowData.source = value;
            break;
          default:
            rowData[cleanHeader] = value;
        }
      });

      return rowData;
    });
  } catch (error) {
    console.error('Parse error:', error);
    return [];
  }
}

/**
 * Generate test data for large paste operations
 */
export function generateTestPasteData(count: number, prefix: string = 'TEST'): PasteData[] {
  return Array.from({ length: count }, (_, i) => ({
    accountId: `${prefix}${String(i + 1).padStart(3, '0')}`,
    name: `Test Account ${i + 1}`,
    status: '', // ✅ REMOVED "Hoạt động" default - empty by default
    source: 'Thử nghiệm',
    rentalPercentage: '0',
    vatPercentage: '0'
  }));
}