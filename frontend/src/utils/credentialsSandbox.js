/**
 * Credentials Sandbox
 * Demo candidates database for Aadhar and PAN verification
 * This simulates a real credential verification system for testing
 */

export const DEMO_CANDIDATES = [
    {
        id: 1,
        fullName: "Rahul Sharma",
        aadhaar: "123456789012",
        pan: "ABCDE1234F",
        walletId: "0x1234567890abcdef1234567890abcdef12345678",
        dob: "1995-05-15",
        gender: "Male",
        verified: true,
        verificationDate: "2024-01-10"
    },
    {
        id: 2,
        fullName: "Priya Patel",
        aadhaar: "234567890123",
        pan: "BCDEF2345G",
        walletId: "0x2345678901bcdef01234567890abcdef123456ab",
        dob: "1996-08-22",
        gender: "Female",
        verified: true,
        verificationDate: "2024-01-12"
    },
    {
        id: 3,
        fullName: "Amit Kumar Singh",
        aadhaar: "345678901234",
        pan: "CDEFG3456H",
        walletId: "0x3456789012cdef012345678901abcdef12345abc",
        dob: "1994-03-10",
        gender: "Male",
        verified: true,
        verificationDate: "2024-01-15"
    },
    {
        id: 4,
        fullName: "Neha Gupta",
        aadhaar: "456789012345",
        pan: "DEFGH4567I",
        walletId: "0x456789012def01234567890abcdef123456abcd",
        dob: "1997-11-28",
        gender: "Female",
        verified: true,
        verificationDate: "2024-01-18"
    },
    {
        id: 5,
        fullName: "Rohan Desai",
        aadhaar: "567890123456",
        pan: "EFGHI5678J",
        walletId: "0x56789012def01234567890abcdef123456abcde",
        dob: "1993-07-05",
        gender: "Male",
        verified: true,
        verificationDate: "2024-01-20"
    },
    {
        id: 6,
        fullName: "Anjali Verma",
        aadhaar: "678901234567",
        pan: "FGHIJ6789K",
        walletId: "0x6789012def01234567890abcdef123456abcdef",
        dob: "1998-02-14",
        gender: "Female",
        verified: true,
        verificationDate: "2024-01-22"
    },
    {
        id: 7,
        fullName: "Vikram Reddy",
        aadhaar: "789012345678",
        pan: "GHIJK7890L",
        walletId: "0x789012def01234567890abcdef123456abcdef1",
        dob: "1992-09-19",
        gender: "Male",
        verified: true,
        verificationDate: "2024-01-25"
    },
    {
        id: 8,
        fullName: "Divya Nair",
        aadhaar: "890123456789",
        pan: "HIJKL8901M",
        walletId: "0x89012def01234567890abcdef123456abcdef12",
        dob: "1999-12-03",
        gender: "Female",
        verified: true,
        verificationDate: "2024-01-28"
    },
    {
        id: 9,
        fullName: "Arjun Bhat",
        aadhaar: "901234567890",
        pan: "IJKLM9012N",
        walletId: "0x9012def01234567890abcdef123456abcdef123",
        dob: "1995-06-11",
        gender: "Male",
        verified: true,
        verificationDate: "2024-02-01"
    },
    {
        id: 10,
        fullName: "Shreya Chopra",
        aadhaar: "012345678901",
        pan: "JKLMN0123O",
        walletId: "0xa012def01234567890abcdef123456abcdef1234",
        dob: "1996-10-25",
        gender: "Female",
        verified: true,
        verificationDate: "2024-02-05"
    }
];

/**
 * Verify Aadhar and PAN combination
 * Returns true if both exist together in the demo database
 */
export const verifyCredentials = (aadhaar, pan) => {
    const candidate = DEMO_CANDIDATES.find(
        (c) => c.aadhaar === aadhaar && c.pan === pan
    );
    return candidate ? { verified: true, candidate } : { verified: false };
};

/**
 * Lookup candidate by Aadhar
 */
export const lookupByAadhaar = (aadhaar) => {
    return DEMO_CANDIDATES.find((c) => c.aadhaar === aadhaar);
};

/**
 * Lookup candidate by PAN
 */
export const lookupByPan = (pan) => {
    return DEMO_CANDIDATES.find((c) => c.pan === pan);
};

/**
 * Get all demo candidates
 */
export const getAllCandidates = () => {
    return DEMO_CANDIDATES;
};

/**
 * Search candidates by full name
 */
export const searchByName = (name) => {
    return DEMO_CANDIDATES.filter((c) =>
        c.fullName.toLowerCase().includes(name.toLowerCase())
    );
};

/**
 * Validate Aadhar format (12 digits)
 */
export const isValidAadhaar = (aadhaar) => {
    return /^\d{12}$/.test(aadhaar);
};

/**
 * Validate PAN format (10 chars: 5 letters, 4 digits, 1 letter)
 */
export const isValidPan = (pan) => {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
};

export default {
    DEMO_CANDIDATES,
    verifyCredentials,
    lookupByAadhaar,
    lookupByPan,
    getAllCandidates,
    searchByName,
    isValidAadhaar,
    isValidPan
};
