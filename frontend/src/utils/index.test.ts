import { describe, it, expect } from 'vitest';
import {
  parseGPA, sanitizeCsvCell, isValidSGPA, rankSuffix, formatSemester,
  extractStream, compactNumber, programAbbr, sgpaLabel,
} from '@/utils';

describe('parseGPA', () => {
  it('parses plain numeric strings', () => {
    expect(parseGPA('8.23')).toBe(8.23);
    expect(parseGPA('10.00')).toBe(10);
    expect(parseGPA('0')).toBe(0);
  });
  it('parses numbers directly (post-Decimal normalization)', () => {
    expect(parseGPA(8.5)).toBe(8.5);
    expect(parseGPA(0)).toBe(0);
  });
  it('treats NaN strings as null', () => {
    expect(parseGPA('abc')).toBeNull();
    expect(parseGPA('N/A')).toBeNull();
  });
  it('returns null for missing values', () => {
    expect(parseGPA(null)).toBeNull();
    expect(parseGPA(undefined)).toBeNull();
    expect(parseGPA('')).toBeNull();
  });
});

describe('sanitizeCsvCell (spreadsheet formula injection)', () => {
  it('prefixes formula-like leading characters', () => {
    expect(sanitizeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(sanitizeCsvCell('+1+1')).toBe("'+1+1");
    expect(sanitizeCsvCell('@cmd')).toBe("'@cmd");
    expect(sanitizeCsvCell('-2+3')).toBe("'-2+3");
    expect(sanitizeCsvCell('\t=1')).toBe("'\t=1");
    expect(sanitizeCsvCell('\r=1')).toBe("'\r=1");
  });
  it('leaves normal text untouched', () => {
    expect(sanitizeCsvCell('AACHAL SINGH')).toBe('AACHAL SINGH');
    expect(sanitizeCsvCell('8.23')).toBe('8.23');
    expect(sanitizeCsvCell('')).toBe('');
  });
  it('does not double-prefix an already sanitized value', () => {
    expect(sanitizeCsvCell("'=1")).toBe("'=1");
  });
});

describe('isValidSGPA', () => {
  it('accepts in-range values', () => {
    expect(isValidSGPA('8.23')).toBe(true);
    expect(isValidSGPA('0')).toBe(true);
    expect(isValidSGPA('10')).toBe(true);
  });
  it('rejects out-of-range or invalid', () => {
    expect(isValidSGPA('10.1')).toBe(false);
    expect(isValidSGPA('-1')).toBe(false);
    expect(isValidSGPA('x')).toBe(false);
    expect(isValidSGPA(null)).toBe(false);
  });
});

describe('rankSuffix', () => {
  it('adds ordinal suffix correctly', () => {
    expect(rankSuffix(1)).toBe('1st');
    expect(rankSuffix(2)).toBe('2nd');
    expect(rankSuffix(3)).toBe('3rd');
    expect(rankSuffix(4)).toBe('4th');
    expect(rankSuffix(11)).toBe('11th');
    expect(rankSuffix(12)).toBe('12th');
    expect(rankSuffix(13)).toBe('13th');
    expect(rankSuffix(21)).toBe('21st');
  });
});

describe('formatSemester', () => {
  it('extracts roman numerals', () => {
    expect(formatSemester('SEMESTER-VI(REGULAR)')).toBe('Sem VI');
    expect(formatSemester('SEMESTER I')).toBe('Sem I');
  });
  it('passes through non-semester names', () => {
    expect(formatSemester('OCT/NOV-2025')).toBe('OCT/NOV-2025');
  });
});

describe('extractStream', () => {
  it('classifies common programs', () => {
    expect(extractStream('B.COM GENERAL')).toBe('B.Com');
    expect(extractStream('BBA GENERAL')).toBe('BBA');
    expect(extractStream('B.SC MPCs')).toBe('B.Sc');
    expect(extractStream('B.A JPE')).toBe('B.A');
  });
});

describe('misc utils', () => {
  it('sgpaLabel thresholds', () => {
    expect(sgpaLabel(9.6)).toBe('Exceptional');
    expect(sgpaLabel(9.2)).toBe('Outstanding');
    expect(sgpaLabel(8.5)).toBe('Excellent');
    expect(sgpaLabel(7.5)).toBe('Very Good');
    expect(sgpaLabel(6.5)).toBe('Good');
    expect(sgpaLabel(5.5)).toBe('Average');
    expect(sgpaLabel(4.9)).toBe('Below Average');
    expect(sgpaLabel(null)).toBe('—');
  });
  it('compactNumber', () => {
    expect(compactNumber(2311)).toBe('2.3k');
    expect(compactNumber(999)).toBe('999');
  });
  it('programAbbr', () => {
    expect(programAbbr('B.COM GENERAL')).toBe('B.COM G');
    expect(programAbbr(null)).toBe('—');
  });
});