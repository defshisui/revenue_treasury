import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';

async function generateUniqueTaxBillNumber(year: string | number): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const taxBillNumber = `TB-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

        const existing = await pool.query(
            'SELECT id FROM business_assessments WHERE tax_bill_number = $1 LIMIT 1',
            [taxBillNumber]
        );

        if (existing.rows.length === 0) {
            return taxBillNumber;
        }
    }

    throw new Error('Unable to generate a unique Tax Bill Number. Please try again.');
}

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

            taxBillNumber: row.tax_bill_number || null,

            businessName: row.business_name,
            businessOwner: row.business_owner,
            status: row.status,
            applicationDate: row.application_date,
            psicCode: row.psic_code,
            grossSales: Number(row.gross_sales || row.grossSales || 0),
            tin: row.tin,
            businessType: row.business_type,
            attachments: row.attachments || [],
            remarks: row.remarks || '',

            paymentStatus: String(row.remarks || '').toLowerCase().startsWith('paid via')
                ? 'PAID'
                : 'UNPAID',

            officialReceiptNumber:
                row.official_receipt_number ||
                row.officialReceiptNumber ||
                (() => {
                    const remarks = String(row.remarks || '');
                    const match = remarks.match(/(?:OR|O\.R\.)\s*:\s*([^\s]+)/i);
                    return match ? match[1] : '';
                })(),

            computedFees: row.computed_fees || {}
        }));

        res.json({
            assessments: formatted,
            totalPages: 1
        });

    } catch (err) {
        console.error('Error fetching business assessments:', err);
        res.status(500).json({
            message: 'Error loading business tax assessments'
        });
    }
}

export async function createSalesDeclaration(req: Request, res: Response): Promise<void> {
    const {
        businessName,
        grossSales,
        year,
        psicCode,
        tin,
        email
    } = req.body;

    if (!businessName || grossSales === undefined || !year || !psicCode || !tin || !email) {
        res.status(400).json({
            message: 'Business name, gross sales, year, psic code, tin, and email are required.'
        });
        return;
    }

    const numericSales = Number(grossSales);

    if (isNaN(numericSales) || numericSales < 0) {
        res.status(400).json({
            message: 'Gross sales must be a valid non-negative number.'
        });
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        res.status(400).json({
            message: 'Invalid email address format.'
        });
        return;
    }

    const file = (req as any).file;

    const trackingNumber = `MP-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    const taxBillNumber = await generateUniqueTaxBillNumber(year);

    const id = randomUUID();

    try {
        const fileAttachment = file
            ? [{
                name: file.originalname,
                url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
            }]
            : [{
                name: 'Financial_Statement.pdf',
                url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            }];

        const result = await pool.query(
            `INSERT INTO business_assessments 
            (
                id,
                tracking_number,
                tax_bill_number,
                business_name,
                business_owner,
                status,
                psic_code,
                gross_sales,
                tin,
                email,
                attachments
            )
            VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                id,
                trackingNumber,
                taxBillNumber,
                businessName || 'Unnamed Business',
                email ? email.split('@')[0] : 'Declared Owner',
                psicCode || '47110',
                grossSales || 0,
                tin || '',
                email || '',
                JSON.stringify(fileAttachment)
            ]
        );

        await recordAudit(
            req,
            'AUD-BIZ-SUBMIT',
            email || 'citizen@gov.ph',
            'Citizen',
            'Business Tax Module',
            'SALES_DECLARATION_SUBMITTED',
            'INFO',
            null,
            `Submitted sales declaration for ${businessName} with tracking ${trackingNumber} and Tax Bill Number ${taxBillNumber}`
        );

        res.status(201).json({
            message: 'Sales declaration saved successfully',
            record: result.rows[0],

            taxBillNumber
        });

    } catch (err) {
        console.error('Error saving sales declaration:', err);

        res.status(500).json({
            message: 'Failed to submit sales declaration.'
        });
    }
}

export async function updateAssessmentStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status, remarks, computedFees } = req.body;

    try {
        const result = await pool.query(
            `UPDATE business_assessments 
            SET status = $1,
                remarks = $2,
                computed_fees = $3
            WHERE id = $4
            RETURNING *`,
            [
                status,
                remarks,
                JSON.stringify(computedFees || {}),
                id
            ]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: 'Assessment record not found.'
            });
            return;
        }

        await recordAudit(
            req,
            'AUD-BIZ-STATUS',
            'admin@lgu.gov.ph',
            'admin',
            'Business Tax Module',
            'ASSESSMENT_STATUS_UPDATED',
            'INFO',
            null,
            `Updated business assessment ${id} to status ${status}`
        );

        res.status(200).json({
            message: 'Status updated successfully',
            record: result.rows[0]
        });

    } catch (err) {
        console.error('Error updating assessment status:', err);

        res.status(500).json({
            message: 'Failed to update status.'
        });
    }
}

export async function deleteBusinessAssessment(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM business_assessments
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: 'Assessment record not found.'
            });
            return;
        }

        await recordAudit(
            req,
            'AUD-BIZ-DELETE',
            'admin@lgu.gov.ph',
            'admin',
            'Business Tax Module',
            'ASSESSMENT_RECORD_DELETED',
            'WARNING',
            null,
            `Deleted business tax assessment record with ID ${id}`
        );

        res.status(200).json({
            message: 'Assessment record deleted successfully.'
        });

    } catch (err) {
        console.error('Error deleting assessment record:', err);

        res.status(500).json({
            message: 'Failed to delete record from server.'
        });
    }
}

export async function verifyTaxBill(req: Request, res: Response): Promise<void> {
    const {
        permitNo,
        taxBillNo,
        tin
    } = req.body;

    const suppliedTaxBillNumber = String(taxBillNo || '').trim();
    const suppliedTin = String(tin || '').trim();

    if (!suppliedTaxBillNumber || !suppliedTin) {
        res.status(400).json({
            message: 'Tax Bill Number and TIN are required.'
        });
        return;
    }

    try {
        const query = `
            SELECT *
            FROM business_assessments
            WHERE tax_bill_number = $1
              AND tin = $2
            LIMIT 1
        `;

        const result = await pool.query(
            query,
            [
                suppliedTaxBillNumber,
                suppliedTin
            ]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: 'Tax Bill Number not found or does not match the supplied TIN.'
            });
            return;
        }

        const record = result.rows[0];

        const isPaid = String(record.remarks || '')
            .toLowerCase()
            .startsWith('paid via');

        if (isPaid) {
            res.status(409).json({
                message: 'This Tax Bill has already been paid. Please use the O.R. Number Verification instead.',
                status: 'PAID',
                record: {
                    businessName: record.business_name,
                    taxBillNo: record.tax_bill_number,
                    tin: record.tin
                }
            });
            return;
        }

        let verificationStatus = 'PENDING EVALUATION';

        if (String(record.status || '').toUpperCase() === 'APPROVED') {
            verificationStatus = 'VALID & ASSESSED';
        }

        res.status(200).json({
            status: verificationStatus,

            record: {
                businessName: record.business_name,

                taxBillNo: record.tax_bill_number,

                trackingNumber: record.tracking_number,

                tin: record.tin,

                grossSales: record.gross_sales,

                computedFees: record.computed_fees,

                assessmentStatus: record.status,

                paymentStatus: 'UNPAID'
            }
        });

    } catch (err: any) {
        console.error('Error verifying tax bill:', err);

        res.status(500).json({
            message: err.message || 'Server error during tax bill verification.'
        });
    }
}

export async function verifyOrNumber(req: Request, res: Response): Promise<void> {
    const {
        permitNo,
        orNo,
        tin
    } = req.body;

    if (!permitNo || !orNo || !tin) {
        res.status(400).json({
            message: 'Permit/Tracking number, OR number, and TIN are required.'
        });
        return;
    }

    try {
        const query = `
            SELECT *
            FROM business_assessments
            WHERE (tracking_number = $1 OR id::text = $1)
              AND tin = $2
            LIMIT 1
        `;

        const result = await pool.query(
            query,
            [
                permitNo,
                tin
            ]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: 'Official Receipt (O.R.) record not found or mismatched TIN/Permit details.'
            });
            return;
        }

        const record = result.rows[0];

        const isPaid = String(record.remarks || '')
            .toLowerCase()
            .startsWith('paid via');

        if (!isPaid) {
            res.status(409).json({
                message: 'This business tax assessment has not been paid yet. Please use the Tax Bill Number Verification instead.',
                status: 'UNPAID',
                taxBillNumber: record.tax_bill_number || null
            });
            return;
        }

        let fees: any = {
            total: '12,500.00'
        };

        try {
            if (typeof record.computed_fees === 'string') {
                fees = JSON.parse(record.computed_fees);
            } else if (
                record.computed_fees &&
                typeof record.computed_fees === 'object'
            ) {
                fees = record.computed_fees;
            }
        } catch (parseErr) {
            console.warn(
                'Could not parse computed_fees JSON, using default values.'
            );
        }

        const formattedAmount =
            fees?.total !== undefined
                ? String(fees.total)
                : '12,500.00';

        res.status(200).json({
            amount: formattedAmount,

            message: 'Official Receipt verified successfully in treasury records.',

            orNumber:
                record.official_receipt_number ||
                record.officialReceiptNumber ||
                (() => {
                    const remarks = String(record.remarks || '');
                    const match = remarks.match(/(?:OR|O\.R\.)\s*:\s*([^\s]+)/i);
                    return match ? match[1] : orNo;
                })(),

            businessName:
                record.business_name || 'Verified Business',

            paymentStatus: 'PAID'
        });

    } catch (err: any) {
        console.error('Error verifying O.R. number:', err);

        res.status(500).json({
            message:
                err.message ||
                'Server error during O.R. verification.'
        });
    }
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
    const {
        department,
        appointmentType,
        businessName,
        tin,
        address,
        description,
        fullName,
        email,
        phone,
        date,
        timeSlot,
        remarks
    } = req.body;

    if (!department || !appointmentType || !fullName || !email || !date) {
        res.status(400).json({
            message: 'Department, appointment type, full name, email, and date are required.'
        });
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        res.status(400).json({
            message: 'Invalid email address format.'
        });
        return;
    }

    const id = randomUUID();

    try {
        const result = await pool.query(
            `INSERT INTO appointments 
            (
                id,
                department,
                appointment_type,
                business_name,
                tin,
                address,
                description,
                full_name,
                email,
                phone,
                appointment_date,
                time_slot,
                remarks,
                status
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                'PENDING'
            )
            RETURNING *`,
            [
                id,
                department,
                appointmentType,
                businessName || '',
                tin || '',
                address,
                description,
                fullName,
                email,
                phone,
                date,
                timeSlot || '09:00 AM - 10:00 AM',
                remarks
            ]
        );

        await recordAudit(
            req,
            'AUD-APT-SUBMIT',
            email || 'citizen@gov.ph',
            'Citizen',
            'Appointments Module',
            'APPOINTMENT_REQUESTED',
            'INFO',
            null,
            `Scheduled appointment for ${fullName} under ${department} on ${date}`
        );

        res.status(201).json({
            message: 'Appointment submitted successfully',
            record: result.rows[0]
        });

    } catch (err) {
        console.error('Error saving appointment:', err);

        res.status(500).json({
            message: 'Failed to submit appointment.'
        });
    }
}

export async function getAppointments(req: Request, res: Response): Promise<void> {
    const { email } = req.query;

    try {
        let result;

        if (
            email &&
            typeof email === 'string' &&
            email.trim() !== ''
        ) {
            result = await pool.query(
                'SELECT * FROM appointments WHERE email ILIKE $1 ORDER BY created_at DESC',
                [email.trim()]
            );
        } else {
            result = await pool.query(
                'SELECT * FROM appointments ORDER BY created_at DESC'
            );
        }

        const formatted = result.rows.map(row => ({
            id: row.id,
            department: row.department,
            appointmentType: row.appointment_type,
            businessName: row.business_name,
            tin: row.tin,
            address: row.address,
            description: row.description,
            fullName: row.full_name,
            email: row.email,
            phone: row.phone,
            date: row.appointment_date,
            timeSlot: row.time_slot,
            remarks: row.remarks,
            status: row.status,
            createdAt: row.created_at
        }));

        res.json({
            appointments: formatted
        });

    } catch (err) {
        console.error('Error fetching appointments:', err);

        res.status(500).json({
            message: 'Failed to load appointments.'
        });
    }
}

export async function updateAppointmentStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(
            `UPDATE appointments
             SET status = $1
             WHERE id = $2
             RETURNING *`,
            [
                status,
                id
            ]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: 'Appointment not found.'
            });
            return;
        }

        res.status(200).json({
            message: 'Appointment status updated.',
            record: result.rows[0]
        });

    } catch (err) {
        console.error('Error updating appointment status:', err);

        res.status(500).json({
            message: 'Failed to update status.'
        });
    }
}

export async function deleteAppointment(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM appointments
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: 'Appointment record not found.'
            });
            return;
        }

        await recordAudit(
            req,
            'AUD-APT-DELETE',
            'admin@lgu.gov.ph',
            'admin',
            'Appointments Module',
            'APPOINTMENT_DELETED',
            'WARNING',
            null,
            `Deleted appointment record with ID ${id}`
        );

        res.status(200).json({
            message: 'Appointment record successfully deleted.'
        });

    } catch (err) {
        console.error('Error deleting appointment record:', err);

        res.status(500).json({
            message: 'Failed to delete appointment from server.'
        });
    }
}