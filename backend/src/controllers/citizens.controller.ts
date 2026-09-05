import type { Request, Response } from 'express';
import pool from '../db.js';
import type { SaveCitizenBody } from '../types/index.js';

export async function getCitizen(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM citizens WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Citizen profile not found.' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching citizen profile:', err);
    res.status(500).json({ message: 'Error loading citizen profile.' });
  }
}

export async function saveCitizen(req: Request, res: Response): Promise<void> {
  const {
    userId, firstName, middleName, lastName, suffix,
    birthDate, houseNoStreet, barangay, city,
    occupation, sex, mobileNumber,
  } = req.body as SaveCitizenBody;

  if (!userId || !firstName || !lastName || !mobileNumber || !birthDate || !houseNoStreet || !barangay || !city) {
    res.status(400).json({ message: 'Please fill out all required citizen profile fields.' });
    return;
  }

  try {
    const existing = await pool.query('SELECT * FROM citizens WHERE user_id = $1', [userId]);
    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE citizens
         SET first_name=$1, middle_name=$2, last_name=$3, suffix=$4,
             birth_date=$5, house_no_street=$6, barangay=$7, city=$8,
             occupation=$9, sex=$10, mobile_number=$11
         WHERE user_id=$12
         RETURNING *`,
        [firstName, middleName, lastName, suffix, birthDate, houseNoStreet, barangay, city, occupation, sex, mobileNumber, userId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO citizens
         (user_id, first_name, middle_name, last_name, suffix,
          birth_date, house_no_street, barangay, city,
          occupation, sex, mobile_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [userId, firstName, middleName, lastName, suffix, birthDate, houseNoStreet, barangay, city, occupation, sex, mobileNumber]
      );
    }

    res.status(200).json({ message: 'Citizen profile saved successfully', profile: result.rows[0] });
  } catch (err) {
    console.error('Error saving citizen profile:', err);
    res.status(500).json({ message: 'Failed to save citizen profile.' });
  }
}
