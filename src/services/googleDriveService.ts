
const BOUNDARY = '-------314159265358979323846';
const DELIMITER = `\r\n--${BOUNDARY}\r\n`;
const CLOSE_DELIM = `\r\n--${BOUNDARY}--`;

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

export const googleDriveService = {
    // 1. Find file by name
    findFile: async (accessToken: string, fileName: string): Promise<DriveFile | null> => {
        const q = `name = '${fileName}' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name, mimeType)`;

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Drive Find Failed: ${res.status} ${res.statusText} - ${errorText}`);
        }

        const data = await res.json();
        if (data.files && data.files.length > 0) {
            return data.files[0]; // Return the first match
        }
        return null;
    },

    // 2. Upload (Create or Update)
    uploadFile: async (accessToken: string, fileName: string, content: string, fileId?: string): Promise<DriveFile> => {
        const contentType = 'application/json';
        const metadata = {
            name: fileName,
            mimeType: contentType
        };

        const multipartRequestBody =
            DELIMITER +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            DELIMITER +
            `Content-Type: ${contentType}\r\n\r\n` +
            content +
            CLOSE_DELIM;

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (fileId) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${BOUNDARY}`
            },
            body: multipartRequestBody
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive Upload Failed: ${res.status} ${err}`);
        }

        return await res.json();
    },

    // 3. Download
    downloadFile: async (accessToken: string, fileId: string): Promise<string> => {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) {
            throw new Error(`Drive Download Failed: ${res.status}`);
        }

        return await res.text();
    }
};
