import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';

export async function getHawkers(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM hawker_associations ORDER BY created_at DESC');
    const formatted = result.rows.map((row) => ({
      id: row.id,
      associationNumber: row.association_number,
      associationName: row.association_name,
      secRegistrationNo: row.sec_registration_no,
      dateIssued: row.date_issued,
      contactNumber: row.contact_number,
      chairperson: {
        firstName: row.first_name,
        middleName: row.middle_name,
        lastName: row.last_name,
        email: row.email,
      },
      submittedBy: row.submitted_by,
      submitterEmail: row.submitter_email,
      submissionDate: row.submission_date,
      status: row.status,
      remarks: row.remarks || '',
      memberCount: row.member_count || 0,

      lguMeta: row.lgu_meta || null,
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching hawker associations:', err);
    res.status(500).json({ message: 'Error loading hawker associations' });
  }
}

export async function createHawker(req: Request, res: Response): Promise<void> {

  const data = req.body as any;

  if (!data.associationNumber || !data.associationName || !data.contactNumber ||
    !data.chairperson?.firstName || !data.chairperson?.lastName || !data.chairperson?.email) {
    res.status(400).json({ message: 'Association number, association name, contact number, and chairperson details (first name, last name, email) are required.' });
    return;
  }

  try {
    const duplicateCheck = await pool.query(
      'SELECT id FROM hawker_associations WHERE association_number = $1',
      [data.associationNumber]
    );
    if (duplicateCheck.rows.length > 0) {
      res.status(400).json({ message: `Association number ${data.associationNumber} is already registered.` });
      return;
    }

    const result = await pool.query(
      `INSERT INTO hawker_associations
       (id, association_number, association_name, sec_registration_no, date_issued, contact_number,
        first_name, middle_name, last_name, email, submitted_by, submitter_email,
        submission_date, status, remarks, member_count, lgu_meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        data.id || randomUUID(),
        data.associationNumber,
        data.associationName,
        data.secRegistrationNo || '',
        data.dateIssued || '',
        data.contactNumber,
        data.chairperson?.firstName || '',
        data.chairperson?.middleName || '',
        data.chairperson?.lastName || '',
        data.chairperson?.email || '',
        data.submittedBy || 'System Citizen',
        data.submitterEmail || data.chairperson?.email || '',
        data.submissionDate || new Date().toISOString().split('T')[0],
        data.status || 'New',
        data.remarks || '',
        data.memberCount || 0,

        data.lguMeta ? JSON.stringify(data.lguMeta) : null
      ]
    );

    await recordAudit(req, 'AUD-HAWKER-SUBMIT', data.submitterEmail || 'citizen@gov.ph', 'Citizen',
      'Hawker Module', 'HAWKER_APPLICATION_SUBMITTED', 'INFO', null,
      `Submitted application for association: ${data.associationName}`);

    res.status(201).json({ message: 'Hawker association application saved successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error saving hawker application:', err);
    res.status(500).json({ message: 'Failed to save hawker association to database.' });
  }
}

export async function updateHawkerStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, remarks } = req.body as { status: string; remarks: string };

  try {
    const result = await pool.query(
      `UPDATE hawker_associations
       SET status=$1, remarks=$2
       WHERE id::text=$3 OR association_number=$3
       RETURNING *`,
      [status, remarks, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Hawker association record not found.' });
      return;
    }

    await recordAudit(req, 'AUD-HAWKER-UPDATE', 'system-admin@lgu.gov.ph', 'admin',
      'Hawker Module', 'HAWKER_STATUS_UPDATED', 'INFO', null,
      `Updated association ${id} status to ${status}`);

    res.status(200).json({ message: 'Hawker status updated successfully', record: result.rows[0] });
  } catch (err) {
    console.error('Error updating hawker status:', err);
    res.status(500).json({ message: 'Failed to update hawker association.' });
  }
}

export async function deleteHawker(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM hawker_associations WHERE association_number=$1 OR id::text=$1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Hawker record not found in database' });
      return;
    }

    await recordAudit(req, 'AUD-HAWKER-DELETE', 'system-admin@lgu.gov.ph', 'admin',
      'Hawker Module', 'HAWKER_ASSOCIATION_DELETED', 'WARNING', `Deleted hawker record ${id}`, null);

    res.status(200).json({
      message: 'Hawker association deleted successfully from database',
      deletedRecord: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting hawker association:', err);
    res.status(500).json({ message: 'Failed to delete hawker association from database.' });
  }
}