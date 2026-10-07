/**
 * The official list of NSTP "Programs" a trainee can belong to — MARSU's
 * colleges, each offered at one campus. This is the only list offered in
 * program selections (registration, masterlist, student records).
 *
 * `courses` maps the degree courses that fall under each college, so older
 * records/files that still name a course (e.g. "BS Information Technology")
 * are converted to their college.
 */
const COLLEGES = [
  { code: 'CES', name: 'College of Environmental Science', campus: 'MARSU - Boac (Main)', courses: ['BS Environmental Science'] },
  { code: 'CGOV', name: 'College of Governance', campus: 'MARSU - Boac (Main)', courses: ['Bachelor of Public Administration', 'BS Criminology'] },
  { code: 'CBA', name: 'College of Business and Accountancy', campus: 'MARSU - Boac (Main)', courses: ['BS Business Administration', 'BS Accountancy'] },
  { code: 'CICS', name: 'College of Information and Computing Sciences', campus: 'MARSU - Boac (Main)', courses: ['BS Information Technology', 'BS Computer Science', 'BS Information Systems'] },
  { code: 'COE', name: 'College of Engineering', campus: 'MARSU - Boac (Main)', courses: ['BS Civil Engineering', 'BS Electrical Engineering', 'BS Mechanical Engineering'] },
  { code: 'CAHS', name: 'College of Allied Health and Sciences', campus: 'MARSU - Boac (Main)', courses: ['BS Nursing'] },
  { code: 'CED', name: 'College of Education', campus: 'MARSU - Boac (Main)', courses: ['Bachelor of Elementary Education', 'Bachelor of Secondary Education'] },
  { code: 'CASS', name: 'College of Arts and Social Sciences', campus: 'MARSU - Boac (Main)', courses: ['BA Communication', 'BA Political Science'] },
  { code: 'CIT', name: 'College of Industrial Technology', campus: 'MARSU - Boac (Main)', courses: ['BS Industrial Technology'] },
  { code: 'CFIS', name: 'College of Fisheries', campus: 'MARSU - Gasan', courses: ['BS Fisheries'] },
  { code: 'CTOUR', name: 'College of Tourism', campus: 'MARSU - Sta. Cruz', courses: ['BS Tourism Management', 'BS Hospitality Management'] },
  { code: 'CAGRI', name: 'College of Agriculture', campus: 'MARSU - Torrijos', courses: ['BS Agriculture', 'BS Agribusiness'] },
];

/** College for a course name (or a college name itself); null if unknown. */
function collegeFor(courseOrCollege) {
  const v = String(courseOrCollege || '').trim().toLowerCase();
  return (
    COLLEGES.find((c) => c.name.toLowerCase() === v || c.code.toLowerCase() === v) ||
    COLLEGES.find((c) => c.courses.some((k) => k.toLowerCase() === v)) ||
    null
  );
}

module.exports = { COLLEGES, collegeFor };
