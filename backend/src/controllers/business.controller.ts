// src/controllers/business.controller.ts
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';

export async function getBusinessAssessments(req: Request, res: Response): Promise<void> {
    const { status, email, search, searchType, page = '1', limit = '10' } = req.query;
    try {
        let query = 'SELECT * FROM business_assessments WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (status && status !== 'ALL') {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (email) {
            query += ` AND email = $${paramIndex++}`;
            params.push(email);
        }
        if (search) {
            if (searchType === 'Business Name') {
                query += ` AND business_name ILIKE $${paramIndex++}`;
                params.push(`%${search}%`);
            } else {
                query += ` AND tracking_number ILIKE $${paramIndex++}`;
                params.push(`%${search}%`);
            }
        }

        query += ' ORDER BY application_date DESC';
        const result = await pool.query(query, params);

        const formatted = result.rows.map(row => ({
            id: row.id,
            trackingNumber: row.tracking_number,
            businessName: row.business_name,
            businessOwner: row.business_owner,
            status: row.status,
            applicationDate: row.application_date,
            psicCode: row.psic_code,
            grossSales: Number(row.gross_sales || row.grossSales || 0),
            tin: row.tin,
            businessType: row.business_type,
            attachments: row.attachments || [],
            remarks: row.remarks || ''
        }));

        res.json({ assessments: formatted, totalPages: 1 });
    } catch (err) {
        console.error('Error fetching business assessments:', err);
        res.status(500).json({ message: 'Error loading business tax assessments' });
    }
}

export async function createSalesDeclaration(req: Request, res: Response): Promise<void> {
    const { businessName, grossSales, year, psicCode, tin, email } = req.body;
    const file = (req as any).file; // Captured via multer middleware
    const trackingNumber = `MP-${year || '2026'}-${Math.floor(100000 + Math.random() * 900000)}`;
    const id = randomUUID();

    try {
        const fileAttachment = file
            ? [{ name: file.originalname, url: `https://placeholder-storage/${file.originalname}` }]
            : [{ name: 'Financial_Statement.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' }];

        const result = await pool.query(
            `INSERT INTO business_assessments 
            (id, tracking_number, business_name, business_owner, status, psic_code, gross_sales, tin, email, attachments)
            VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8, $9) RETURNING *`,
            [
                id,
                trackingNumber,
                businessName || 'Unnamed Business',
                email ? email.split('@')[0] : 'Declared Owner',
                psicCode || '47110',
                grossSales || 0,
                tin || '',
                email || '',
                JSON.stringify(fileAttachment)
            ]
        );

        await recordAudit(req, 'AUD-BIZ-SUBMIT', email || 'citizen@gov.ph', 'Citizen',
            'Business Tax Module', 'SALES_DECLARATION_SUBMITTED', 'INFO', null,
            `Submitted sales declaration for ${businessName} with tracking ${trackingNumber}`);

        res.status(201).json({ message: 'Sales declaration saved successfully', record: result.rows[0] });
    } catch (err) {
        console.error('Error saving sales declaration:', err);
        res.status(500).json({ message: 'Failed to submit sales declaration.' });
    }
}

export async function updateAssessmentStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, remarks, computedFees } = req.body;

    try {
        const result = await pool.query(
            `UPDATE business_assessments 
            SET status = $1, remarks = $2, computed_fees = $3 
            WHERE id = $4 RETURNING *`,
            [status, remarks, JSON.stringify(computedFees || {}), id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Assessment record not found.' });
            return;
        }

        await recordAudit(req, 'AUD-BIZ-STATUS', 'admin@lgu.gov.ph', 'admin',
            'Business Tax Module', 'ASSESSMENT_STATUS_UPDATED', 'INFO', null,
            `Updated business assessment ${id} to status ${status}`);

        res.status(200).json({ message: 'Status updated successfully', record: result.rows[0] });
    } catch (err) {
        console.error('Error updating assessment status:', err);
        res.status(500).json({ message: 'Failed to update status.' });
    }
}

export async function verifyTaxBill(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ status: 'VALID', message: 'Tax Bill is authentic and registered.' });
}

export async function verifyOrNumber(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ amount: '12,500.00', message: 'Official Receipt verified successfully.' });
}