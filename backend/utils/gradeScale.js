/**
 * Converts a 0-100 raw percentage into the 1.00-5.00 college grading scale
 * (1.00 highest, 5.00 lowest) using the standard CHED-style transmutation
 * table. 75% is the minimum passing percentage, which lands on 3.00; every
 * percentage below that transmutes into an equally-spaced failing point
 * between 3.25 and 5.00 instead of collapsing straight to a flat 5.00.
 */
const GRADE_POINT_TABLE = [
  { min: 97.5, point: 1.0 },
  { min: 94.5, point: 1.25 },
  { min: 91.5, point: 1.5 },
  { min: 88.5, point: 1.75 },
  { min: 85.5, point: 2.0 },
  { min: 82.5, point: 2.25 },
  { min: 79.5, point: 2.5 },
  { min: 76.5, point: 2.75 },
  { min: 75, point: 3.0 },
  { min: 65.625, point: 3.25 },
  { min: 56.25, point: 3.5 },
  { min: 46.875, point: 3.75 },
  { min: 37.5, point: 4.0 },
  { min: 28.125, point: 4.25 },
  { min: 18.75, point: 4.5 },
  { min: 9.375, point: 4.75 },
  { min: 0, point: 5.0 },
];

/** Highest (best) grade point that still counts as passing. */
const PASSING_POINT = 3.0;

function gradePointFrom(percentage) {
  const value = Number(percentage) || 0;
  const row = GRADE_POINT_TABLE.find((r) => value >= r.min);
  return row ? row.point : 5.0;
}

module.exports = { gradePointFrom, PASSING_POINT, GRADE_POINT_TABLE };
