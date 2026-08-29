// src/controllers/market.controller.ts
import type { Request, Response } from 'express';
import pool from '../db.js';
import { recordAudit } from './audit.controller.js';
import { AntiFraudService } from '../services/antiFraud.service.js';
import type { SaveLeaseBody, FraudScanBody } from '../types/index.js';

function resolvePaymentMethod(body: Partial<SaveLeaseBody>): string {
  const raw = body.paymentMethod || body.payment_method;
  return raw && String(raw).trim() !== '' ? String(raw).trim() : 'Cash / Direct';
}

export async function getTransactions(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM market_leases ORDER BY created_at DESC');
    const formatted = result.rows.map((row: any) => {
      let formattedDate = '2026-06-15';
      if (row.created_at) {
        const d = new Date(row.created_at);
        if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
      }
      return {
        id: row.id ? row.id.toString() : '1',
        transactionId: `TX-${row.lease_id || row.id}`,
        referenceNumber: row.lease_id || `REF-${row.id}`,
        taxpayer: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown Taxpayer',
        paymentType: 'Market Rental',
        amount: parseFloat(row.amount_due) || 0,
        paymentMethod: row.payment_method || 'Cash / Direct',
        collector: 'Municipal Treasury',
        date: formattedDate,
        status: row.payment_status?.toLowerCase().includes('paid') ? 'Posted' : 'Pending',
        remarks: `Stall ${row.stall_number || 'N/A'} (${row.market_name || 'Public Market'})`,
      };
    });
    res.json(formatted);
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ message: 'Error loading transactions' });
  }
}

export async function createTransaction(_req: Request, res: Response): Promise<void> {
  res.status(201).json({ message: 'Transaction recorded successfully' });
}

export async function getMarketLeases(_req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT * FROM market_leases ORDER BY created_at DESC');
    const formatted = result.rows.map((row: any) => ({
      id: row.id.toString(),
      leaseId: row.lease_id,
      firstName: row.first_name,
      lastName: row.last_name,
      marketName: row.market_name,
      section: row.section,
      stallNumber: row.stall_number,
      leaseStatus: row.lease_status,
      amountDue: parseFloat(row.amount_due) || 0,
      helperApprovalStatus: row.helper_approval_status,
      advancePaymentStatus: row.advance_payment_status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method || 'Cash / Direct',
      createdAt: row.created_at,
    }));
    res.json(formatted);
  } catch (err: any) {
    console.error('Error fetching market leases:', err);
    res.status(500).json({ message: 'Error loading market leases' });
  }
}

export async function createMarketLease(req: Request, res: Response): Promise<void> {
  const body = req.body as SaveLeaseBody;
  const { firstName, lastName, marketName, section, stallNumber,
    leaseStatus, amountDue, helperApprovalStatus, advancePaymentStatus, paymentStatus } = body;

  if (!firstName || !lastName || !marketName || !section || !stallNumber) {
    res.status(400).json({ message: 'First name, last name, market name, section, and stall number are required.' });
    return;
  }

  const resolvedPaymentMethod = resolvePaymentMethod(body);
  const applicantEmail = `${firstName.trim()}.${lastName.trim()}@citizen.gov.ph`.toLowerCase().replace(/\s+/g, '');

  try {
    if (body.leaseId) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM market_leases WHERE lease_id = $1',
        [body.leaseId]
      );
      if (duplicateCheck.rows.length > 0) {
        res.status(400).json({ message: `Lease ID ${body.leaseId} is already registered.` });
        return;
      }
    }
    // --- Real Anti-Fraud AI Validation ---
    const rawForwarded = req?.headers['x-forwarded-for'];
    const clientIP = typeof rawForwarded === 'string'
      ? rawForwarded.split(',')[0].trim()
      : (Array.isArray(rawForwarded) ? rawForwarded[0].trim() : (req?.ip || req?.socket?.remoteAddress || 'Unknown'));

    const fraudCheck = await AntiFraudService.evaluateRisk({
      ip: clientIP !== 'Unknown' ? clientIP : undefined,
      email: applicantEmail,
      username: `${firstName || ''} ${lastName || ''}`.trim(),
      amount: parseFloat(String(amountDue || 0)),
      currency: 'PHP',
    });

    if (fraudCheck.isFraud) {
      console.warn(`[Anti-Fraud] Blocked market stall application for ${applicantEmail}. Score: ${fraudCheck.score}`);
      await recordAudit(
        req,
        'AUD-FRAUD-MARKET-BLOCK',
        applicantEmail,
        'Citizen',
        'Market Stall',
        'STALL_APPLICATION_BLOCKED',
        'CRITICAL',
        `Stall ${stallNumber} at ${marketName}`,
        `Blocked by Anti-Fraud AI. Score: ${fraudCheck.score}`
      );
      res.status(403).json({ message: 'Application blocked by security policy. Please verify your details or visit the treasury office in person.' });
      return;
    }
    // -------------------------------------

    const result = await pool.query(
      `INSERT INTO market_leases
       (lease_id, first_name, last_name, market_name, section, stall_number, lease_status,
        amount_due, helper_approval_status, advance_payment_status, payment_status, payment_method, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING *`,
      [
        body.leaseId || `LEASE-${Date.now()}`,
        firstName, lastName, marketName, section, stallNumber,
        leaseStatus || 'Active', amountDue || 0,
        helperApprovalStatus || 'Pending',
        advancePaymentStatus || 'Requested',
        paymentStatus || 'Pending Payment',
        resolvedPaymentMethod,
      ]
    );

    // Audit logging must not make a successfully saved lease fail.
    try {
      await recordAudit(
        req,
        'AUD-MARKET-SUBMIT',
        applicantEmail,
        'Citizen',
        'Market Module',
        'STALL_APPLICATION_SUBMITTED',
        'INFO',
        null,
        `Applied for Stall ${stallNumber} at ${marketName} via ${resolvedPaymentMethod} (Anti-Fraud Score: ${fraudCheck.score})`
      );
    } catch (auditError: any) {
      console.error('Market lease saved, but audit logging failed:', auditError);
    }

    res.status(201).json({
      message: 'Lease application saved successfully',
      lease: result.rows[0],
    });
  } catch (err: any) {
    console.error('Error saving market lease:', err);

    res.status(500).json({
      message: 'Failed to save market lease application to database.',
      error: err?.message || 'Unknown database error',
    });
  }
}

export async function updateMarketLease(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as SaveLeaseBody;
  const { firstName, lastName, marketName, section, stallNumber,
    leaseStatus, amountDue, helperApprovalStatus, advancePaymentStatus, paymentStatus } = body;

  if (!firstName || !lastName || !marketName || !section || !stallNumber) {
    res.status(400).json({ message: 'First name, last name, market name, section, and stall number are required.' });
    return;
  }

  const resolvedPaymentMethod = resolvePaymentMethod(body);

  try {
    const result = await pool.query(
      `UPDATE market_leases
       SET first_name=$1, last_name=$2, market_name=$3, section=$4, stall_number=$5,
           lease_status=$6, amount_due=$7, helper_approval_status=$8,
           advance_payment_status=$9, payment_status=$10, payment_method=$11
       WHERE lease_id=$12 OR id::text=$12
       RETURNING *`,
      [firstName, lastName, marketName, section, stallNumber,
       leaseStatus, amountDue || 0, helperApprovalStatus,
       advancePaymentStatus, paymentStatus, resolvedPaymentMethod, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Lease record not found' });
      return;
    }

    await recordAudit(req, 'AUD-MARKET-UPDATE', 'system-admin@lgu.gov.ph', 'admin',
      'Market Module', 'STALL_APPLICATION_UPDATED', 'INFO', null,
      `Updated lease record for Stall ${stallNumber} (${id}) with payment method: ${resolvedPaymentMethod}`);

    res.status(200).json({ message: 'Lease updated successfully', lease: result.rows[0] });
  } catch (err: any) {
    console.error('Error updating market lease:', err);
    res.status(500).json({ message: 'Failed to update market lease in database.' });
  }
}

export async function deleteMarketLease(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM market_leases WHERE lease_id=$1 OR id::text=$1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Lease record not found in database' });
      return;
    }

    await recordAudit(req, 'AUD-MARKET-DELETE', 'system-admin@lgu.gov.ph', 'admin',
      'Market Module', 'STALL_LEASE_DELETED', 'WARNING', `Deleted lease record ${id}`, null);

    res.status(200).json({ message: 'Lease deleted successfully from database', deletedLease: result.rows[0] });
  } catch (err: any) {
    console.error('Error deleting market lease:', err);
    res.status(500).json({ message: 'Failed to delete market lease from database.' });
  }
}

export async function fraudScan(req: Request, res: Response): Promise<void> {
  const body = req.body as FraudScanBody;
  const rawId = body.leaseId || body.id || body.lease_id;

  if (!rawId) {
    res.status(400).json({ error: 'Lease ID is required for fraud analysis.' });
    return;
  }

  const searchId = String(rawId).trim();

  try {
    let leaseQuery = await pool.query('SELECT * FROM market_leases WHERE lease_id=$1', [searchId]);

    if (leaseQuery.rows.length === 0 && !isNaN(Number(searchId))) {
      leaseQuery = await pool.query('SELECT * FROM market_leases WHERE id=$1', [parseInt(searchId, 10)]);
    }

    if (leaseQuery.rows.length === 0) {
      res.status(404).json({ error: 'Lease record not found in database.' });
      return;
    }

    const lease = leaseQuery.rows[0];
    const flags: string[] = [];
    const amountDue = parseFloat(lease.amount_due) || 0;
    const applicantName = `${lease.first_name || ''} ${lease.last_name || ''}`.trim();
    const applicantEmail = `${lease.first_name || 'applicant'}.${lease.last_name || 'taxpayer'}@citizen.gov.ph`.toLowerCase().replace(/\s+/g, '');

    // 1. Live AI Screening via FraudLabs Pro
    const rawForwarded = req?.headers['x-forwarded-for'];
    const clientIP = typeof rawForwarded === 'string'
      ? rawForwarded.split(',')[0].trim()
      : (Array.isArray(rawForwarded) ? rawForwarded[0].trim() : (req?.ip || req?.socket?.remoteAddress || 'Unknown'));

    const aiCheck = await AntiFraudService.evaluateRisk({
      ip: clientIP !== 'Unknown' ? clientIP : undefined,
      email: applicantEmail,
      username: applicantName,
      amount: amountDue,
      currency: 'PHP',
    });

    let riskScore = aiCheck.score > 0 ? Math.round(aiCheck.score * 0.6) : 10;

    if (aiCheck.score > 0) {
      flags.push(`FraudLabs Pro AI Risk Score: ${aiCheck.score}/100.`);
    }

    // 2. Financial threshold heuristic
    if (amountDue > 50000) {
      riskScore += 25;
      flags.push(`High financial exposure detected: ₱${amountDue.toLocaleString()} exceeds standard median threshold.`);
    }

    // 3. Multi-stall collision detection
    try {
      const allLeases = (await pool.query('SELECT * FROM market_leases')).rows;
      const nameCollisions = allLeases.filter((l: any) =>
        l.id !== lease.id &&
        String(l.first_name || '').trim().toLowerCase() === String(lease.first_name || '').trim().toLowerCase() &&
        String(l.last_name || '').trim().toLowerCase() === String(lease.last_name || '').trim().toLowerCase()
      );
      if (nameCollisions.length > 0) {
        riskScore += 30;
        flags.push(`Database collision alert: ${nameCollisions.length} other active lease record(s) found under identical name (${lease.first_name} ${lease.last_name}).`);
      }
    } catch (e) {
      console.warn('Market leases batch scan warning:', (e as Error).message);
    }

    // 4. Historical audit trail check
    try {
      const allAudits = (await pool.query('SELECT * FROM audit_logs')).rows;
      const cleanName = applicantName.toLowerCase();
      const suspiciousAudits = allAudits.filter((log: any) => {
        const text = `${log.user_email || ''} ${log.previous_data || ''} ${log.new_data || ''}`.toLowerCase();
        return cleanName && text.includes(cleanName) && ['WARNING', 'CRITICAL'].includes(log.severity);
      });
      if (suspiciousAudits.length > 0) {
        riskScore += 20;
        flags.push(`Security audit trail flags ${suspiciousAudits.length} prior warning or critical event(s) linked to applicant profile.`);
      }
    } catch (e) {
      console.warn('Audit logs batch scan warning:', (e as Error).message);
    }

    if (riskScore > 99) riskScore = 99;
    const riskLevel: 'Low' | 'Medium' | 'High' = riskScore >= 70 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low';
    if (flags.length === 0) flags.push('Database & AI validation passed cleanly. No multi-stall name collisions or abnormal payment spikes found.');

    // Log to audit table if flagged or high risk
    if (riskScore >= 50 || aiCheck.isFraud) {
      await recordAudit(
        req,
        'AUD-FRAUD-MARKET-INSPECT',
        applicantEmail,
        'Admin',
        'Market Stall',
        riskScore >= 70 ? 'STALL_HIGH_RISK_DETECTED' : 'STALL_RISK_FLAGGED',
        riskScore >= 70 ? 'CRITICAL' : 'WARNING',
        `Stall ${lease.stall_number} (${lease.market_name})`,
        `AI Risk Assessment Score: ${riskScore}. Signals: ${flags.join(' | ')}`
      );
    }

    res.status(200).json({ success: true, riskScore, riskLevel, flags });
  } catch (err: any) {
    console.error('Error executing database fraud scan:', err);
    res.status(500).json({ error: 'Internal server error during AI fraud analysis.' });
  }
}
