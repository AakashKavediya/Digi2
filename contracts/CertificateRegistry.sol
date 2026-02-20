// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CertificateRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    // ===================== STUDENT REGISTRY =====================
    struct Student {
        address wallet;
        string name;
        bool exists;
    }

    mapping(bytes32 => Student) public students; // aadhaarHash => Student
    mapping(address => bytes32) public walletToAadhaar; // wallet => aadhaarHash

    // ===================== CERTIFICATES =====================
    struct Certificate {
        bytes32 aadhaarHash;
        address studentWallet;
        address issuer;
        string studentName;
        string courseTitle;
        string ipfsCID;
        uint256 timestamp;
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Certificate) public certificates; // certHash => Certificate
    mapping(address => bytes32[]) public studentCertificates; // wallet => certHash[]

    uint256 public totalCertificates;
    uint256 public totalStudents;

    // ===================== EVENTS =====================
    event StudentRegistered(bytes32 indexed aadhaarHash, address indexed wallet, string name);
    event StudentWalletUpdated(bytes32 indexed aadhaarHash, address oldWallet, address newWallet);
    event CertificateIssued(bytes32 indexed certHash, address indexed studentWallet, address indexed issuer, string courseTitle, uint256 timestamp);
    event CertificateRevoked(bytes32 indexed certHash, address indexed revoker);
    event IssuerGranted(address indexed account, address indexed grantedBy);
    event IssuerRevoked(address indexed account, address indexed revokedBy);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ===================== STUDENT REGISTRATION =====================

    /// @notice Student registers with Aadhaar hash + connects wallet
    function registerStudent(bytes32 _aadhaarHash, string memory _name) external {
        require(!students[_aadhaarHash].exists, "Aadhaar already registered");
        require(walletToAadhaar[msg.sender] == bytes32(0), "Wallet already linked to another Aadhaar");

        students[_aadhaarHash] = Student({
            wallet: msg.sender,
            name: _name,
            exists: true
        });
        walletToAadhaar[msg.sender] = _aadhaarHash;
        totalStudents++;

        emit StudentRegistered(_aadhaarHash, msg.sender, _name);
    }

    /// @notice Get student wallet from Aadhaar hash
    function getStudentByAadhaar(bytes32 _aadhaarHash) external view returns (address wallet, string memory name, bool exists) {
        Student memory s = students[_aadhaarHash];
        return (s.wallet, s.name, s.exists);
    }

    /// @notice Update student wallet (by old wallet owner or admin)
    function updateStudentWallet(bytes32 _aadhaarHash, address _newWallet) external {
        require(students[_aadhaarHash].exists, "Student not found");
        require(
            msg.sender == students[_aadhaarHash].wallet || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized: must be current wallet or admin"
        );
        require(walletToAadhaar[_newWallet] == bytes32(0), "New wallet already linked");

        address oldWallet = students[_aadhaarHash].wallet;
        delete walletToAadhaar[oldWallet];
        students[_aadhaarHash].wallet = _newWallet;
        walletToAadhaar[_newWallet] = _aadhaarHash;

        emit StudentWalletUpdated(_aadhaarHash, oldWallet, _newWallet);
    }

    // ===================== CERTIFICATE ISSUANCE =====================

    /// @notice Institution issues certificate (ISSUER_ROLE required)
    function issueCertificate(
        bytes32 _certHash,
        address _studentWallet,
        bytes32 _aadhaarHash,
        string memory _studentName,
        string memory _courseTitle,
        string memory _ipfsCID
    ) external onlyRole(ISSUER_ROLE) {
        require(_studentWallet != address(0), "Invalid student wallet");
        require(!certificates[_certHash].exists, "Certificate hash already exists");

        certificates[_certHash] = Certificate({
            aadhaarHash: _aadhaarHash,
            studentWallet: _studentWallet,
            issuer: msg.sender,
            studentName: _studentName,
            courseTitle: _courseTitle,
            ipfsCID: _ipfsCID,
            timestamp: block.timestamp,
            revoked: false,
            exists: true
        });

        studentCertificates[_studentWallet].push(_certHash);
        totalCertificates++;

        emit CertificateIssued(_certHash, _studentWallet, msg.sender, _courseTitle, block.timestamp);
    }

    // ===================== VERIFICATION =====================

    /// @notice Verify certificate by hash (anyone can call)
    function verifyCertificate(bytes32 _certHash) external view returns (
        bool exists,
        string memory studentName,
        string memory courseTitle,
        string memory ipfsCID,
        address issuer,
        address studentWallet,
        uint256 timestamp,
        bool revoked
    ) {
        Certificate memory cert = certificates[_certHash];
        return (
            cert.exists,
            cert.studentName,
            cert.courseTitle,
            cert.ipfsCID,
            cert.issuer,
            cert.studentWallet,
            cert.timestamp,
            cert.revoked
        );
    }

    // ===================== STUDENT CERTIFICATE QUERIES =====================

    function getStudentCertificateCount(address _wallet) external view returns (uint256) {
        return studentCertificates[_wallet].length;
    }

    function getStudentCertificateHash(address _wallet, uint256 _index) external view returns (bytes32) {
        return studentCertificates[_wallet][_index];
    }

    // ===================== ADMIN FUNCTIONS =====================

    function revokeCertificate(bytes32 _certHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(certificates[_certHash].exists, "Certificate not found");
        require(!certificates[_certHash].revoked, "Already revoked");
        certificates[_certHash].revoked = true;
        emit CertificateRevoked(_certHash, msg.sender);
    }

    function grantIssuerRole(address _account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ISSUER_ROLE, _account);
        emit IssuerGranted(_account, msg.sender);
    }

    function revokeIssuerRole(address _account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ISSUER_ROLE, _account);
        emit IssuerRevoked(_account, msg.sender);
    }

    // ===================== VIEW HELPERS =====================

    function isIssuer(address _account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, _account);
    }

    function isAdmin(address _account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, _account);
    }
}
