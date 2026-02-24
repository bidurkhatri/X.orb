// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title DecentralizedIdentity
 * @dev Comprehensive decentralized identity management with DID registry and verifiable credentials
 */
contract DecentralizedIdentity is Ownable, ReentrancyGuard, Pausable {
    
    using Math for uint256;

    // Events
    event DIDRegistered(
        bytes32 indexed did,
        address indexed owner,
        uint256 expiry,
        string documentHash
    );

    event DIDTransferred(
        bytes32 indexed did,
        address indexed from,
        address indexed to
    );

    event DIDRevoked(
        bytes32 indexed did,
        address indexed owner
    );

    event DIDDocumentUpdated(
        bytes32 indexed did,
        string documentHash,
        string[] publicKeys,
        string[] services
    );

    event DIDAttributeAdded(
        bytes32 indexed did,
        string attribute,
        string value,
        uint256 expiry
    );

    event DIDAttributeRemoved(
        bytes32 indexed did,
        string attribute
    );

    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed issuer,
        bytes32 indexed subject,
        string credentialHash
    );

    event CredentialRevoked(
        bytes32 indexed credentialId,
        address indexed issuer
    );

    event CredentialVerified(
        bytes32 indexed credentialId,
        address indexed verifier,
        bool valid,
        uint256 timestamp
    );

    event ControllerAdded(
        bytes32 indexed did,
        address indexed controller
    );

    event ControllerRemoved(
        bytes32 indexed did,
        address indexed controller
    );

    // Structs
    struct DIDDocument {
        address owner;
        address[] controllers;
        string documentHash; // IPFS hash
        string[] publicKeys;
        string[] services;
        uint256 expiry;
        uint256 createdAt;
        uint256 lastUpdated;
    }

    struct Attribute {
        string key;
        string value;
        uint256 expiry;
        bool active;
    }

    struct VerifiableCredential {
        bytes32 subject;
        address issuer;
        string credentialHash;
        string[] attributeKeys;
        string[] attributeValues;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
        bool active;
    }

    struct CredentialVerification {
        address verifier;
        uint256 timestamp;
        bool valid;
    }

    // State variables
    mapping(bytes32 => DIDDocument) public didDocuments;
    mapping(bytes32 => Attribute[]) public didAttributes;
    mapping(bytes32 => mapping(address => bool)) public didControllers;
    mapping(bytes32 => mapping(string => bool)) public didAttributeKeys;
    
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(bytes32 => CredentialVerification[]) public credentialVerifications;
    mapping(address => bytes32[]) public issuerCredentials;
    mapping(address => bytes32[]) public subjectCredentials;
    
    // Configuration
    uint256 public registrationFee = 0.01 ether;
    uint256 public attributeFee = 0.001 ether;
    uint256 public credentialFee = 0.005 ether;
    uint256 public defaultExpiry = 365 days;
    uint256 public maximumAttributeLength = 256;
    uint256 public maximumAttributesPerDID = 20;
    
    address public feeRecipient;
    mapping(address => uint256) public protocolFees;
    
    // Analytics
    mapping(address => uint256) public didRegistrations;
    mapping(address => uint256) public credentialsIssued;
    mapping(address => uint256) public credentialsVerified;
    uint256 public totalDIDs;
    uint256 public totalCredentials;
    uint256 public totalVerifications;
    
    // Modifiers
    modifier onlyDIDOwner(bytes32 did) {
        require(didDocuments[did].owner == msg.sender, "Not DID owner");
        _;
    }
    
    modifier onlyDIDController(bytes32 did) {
        require(didDocuments[did].owner == msg.sender || didControllers[did][msg.sender], "Not authorized");
        _;
    }
    
    modifier validDID(bytes32 did) {
        require(did != bytes32(0), "Invalid DID");
        require(didDocuments[did].owner != address(0), "DID not found");
        require(block.timestamp <= didDocuments[did].expiry, "DID expired");
        _;
    }
    
    modifier validAttribute(string memory key, string memory value) {
        require(bytes(key).length > 0, "Invalid attribute key");
        require(bytes(value).length > 0, "Invalid attribute value");
        require(bytes(key).length <= maximumAttributeLength, "Key too long");
        require(bytes(value).length <= maximumAttributeLength, "Value too long");
        _;
    }

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Register a new DID
     */
    function registerDID(
        bytes32 did,
        string calldata documentHash,
        string[] calldata publicKeys,
        string[] calldata services,
        uint256 expiry
    ) external payable whenNotPaused nonReentrant {
        require(did != bytes32(0), "Invalid DID");
        require(didDocuments[did].owner == address(0), "DID already exists");
        require(bytes(documentHash).length > 0, "Document hash required");
        require(publicKeys.length <= 10, "Too many public keys");
        require(services.length <= 10, "Too many services");
        
        if (expiry == 0) {
            expiry = block.timestamp.add(defaultExpiry);
        } else {
            require(expiry > block.timestamp, "Invalid expiry");
        }
        
        require(msg.value >= registrationFee, "Insufficient fee");
        
        didDocuments[did] = DIDDocument({
            owner: msg.sender,
            controllers: new address[](0),
            documentHash: documentHash,
            publicKeys: publicKeys,
            services: services,
            expiry: expiry,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp
        });
        
        protocolFees[address(0)] = protocolFees[address(0)].add(msg.value);
        totalDIDs = totalDIDs.add(1);
        didRegistrations[msg.sender] = didRegistrations[msg.sender].add(1);
        
        // Refund excess fees
        if (msg.value > registrationFee) {
            payable(msg.sender).transfer(msg.value.sub(registrationFee));
        }
        
        emit DIDRegistered(did, msg.sender, expiry, documentHash);
    }

    /**
     * @dev Transfer DID ownership
     */
    function transferDID(bytes32 did, address newOwner) external validDID(did) onlyDIDOwner(did) nonReentrant {
        require(newOwner != address(0), "Invalid new owner");
        require(newOwner != msg.sender, "Same owner");
        
        address oldOwner = didDocuments[did].owner;
        didDocuments[did].owner = newOwner;
        didDocuments[did].lastUpdated = block.timestamp;
        
        emit DIDTransferred(did, oldOwner, newOwner);
    }

    /**
     * @dev Revoke DID
     */
    function revokeDID(bytes32 did) external validDID(did) onlyDIDOwner(did) nonReentrant {
        address owner = didDocuments[did].owner;
        
        delete didDocuments[did];
        delete didAttributes[did];
        
        totalDIDs = totalDIDs.sub(1);
        didRegistrations[owner] = didRegistrations[owner].sub(1);
        
        emit DIDRevoked(did, owner);
    }

    /**
     * @dev Update DID document
     */
    function updateDIDDocument(
        bytes32 did,
        string calldata documentHash,
        string[] calldata publicKeys,
        string[] calldata services
    ) external validDID(did) onlyDIDController(did) nonReentrant {
        require(bytes(documentHash).length > 0, "Document hash required");
        require(publicKeys.length <= 10, "Too many public keys");
        require(services.length <= 10, "Too many services");
        
        DIDDocument storage doc = didDocuments[did];
        doc.documentHash = documentHash;
        doc.publicKeys = publicKeys;
        doc.services = services;
        doc.lastUpdated = block.timestamp;
        
        emit DIDDocumentUpdated(did, documentHash, publicKeys, services);
    }

    /**
     * @dev Add attribute to DID
     */
    function addDIDAttribute(
        bytes32 did,
        string calldata key,
        string calldata value,
        uint256 expiry
    ) external payable validDID(did) validAttribute(key, value) onlyDIDController(did) nonReentrant {
        require(!didAttributeKeys[did][key], "Attribute key already exists");
        require(didAttributes[did].length < maximumAttributesPerDID, "Too many attributes");
        
        if (expiry == 0) {
            expiry = block.timestamp.add(defaultExpiry);
        } else {
            require(expiry > block.timestamp, "Invalid expiry");
        }
        
        require(msg.value >= attributeFee, "Insufficient fee");
        
        didAttributes[did].push(Attribute({
            key: key,
            value: value,
            expiry: expiry,
            active: true
        }));
        
        didAttributeKeys[did][key] = true;
        protocolFees[address(0)] = protocolFees[address(0)].add(msg.value);
        
        // Refund excess fees
        if (msg.value > attributeFee) {
            payable(msg.sender).transfer(msg.value.sub(attributeFee));
        }
        
        emit DIDAttributeAdded(did, key, value, expiry);
    }

    /**
     * @dev Remove attribute from DID
     */
    function removeDIDAttribute(bytes32 did, string calldata key) 
        external validDID(did) onlyDIDController(did) nonReentrant {
        require(didAttributeKeys[did][key], "Attribute key not found");
        
        Attribute[] storage attributes = didAttributes[did];
        for (uint256 i = 0; i < attributes.length; i++) {
            if (keccak256(bytes(attributes[i].key)) == keccak256(bytes(key))) {
                attributes[i].active = false;
                didAttributeKeys[did][key] = false;
                break;
            }
        }
        
        emit DIDAttributeRemoved(did, key);
    }

    /**
     * @dev Add controller to DID
     */
    function addDIDController(bytes32 did, address controller) 
        external validDID(did) onlyDIDOwner(did) nonReentrant {
        require(controller != address(0), "Invalid controller");
        require(!didControllers[did][controller], "Controller already exists");
        
        didControllers[did][controller] = true;
        didDocuments[did].controllers.push(controller);
        didDocuments[did].lastUpdated = block.timestamp;
        
        emit ControllerAdded(did, controller);
    }

    /**
     * @dev Remove controller from DID
     */
    function removeDIDController(bytes32 did, address controller) 
        external validDID(did) onlyDIDOwner(did) nonReentrant {
        require(didControllers[did][controller], "Controller not found");
        
        didControllers[did][controller] = false;
        
        // Remove from controllers array
        address[] storage controllers = didDocuments[did].controllers;
        for (uint256 i = 0; i < controllers.length; i++) {
            if (controllers[i] == controller) {
                controllers[i] = controllers[controllers.length - 1];
                controllers.pop();
                break;
            }
        }
        
        didDocuments[did].lastUpdated = block.timestamp;
        
        emit ControllerRemoved(did, controller);
    }

    /**
     * @dev Issue verifiable credential
     */
    function issueCredential(
        bytes32 credentialId,
        bytes32 subject,
        string calldata credentialHash,
        string[] calldata attributes,
        string[] calldata values,
        uint256 expiresAt
    ) external payable whenNotPaused nonReentrant {
        require(credentialId != bytes32(0), "Invalid credential ID");
        require(credentials[credentialId].issuer == address(0), "Credential already exists");
        require(bytes(credentialHash).length > 0, "Credential hash required");
        require(attributes.length == values.length, "Mismatched arrays");
        require(attributes.length <= 10, "Too many attributes");
        
        if (expiresAt == 0) {
            expiresAt = block.timestamp.add(defaultExpiry);
        } else {
            require(expiresAt > block.timestamp, "Invalid expiry");
        }
        
        require(msg.value >= credentialFee, "Insufficient fee");
        
        credentials[credentialId] = VerifiableCredential({
            subject: subject,
            issuer: msg.sender,
            credentialHash: credentialHash,
            attributeKeys: attributes,
            attributeValues: values,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            active: true
        });
        
        issuerCredentials[msg.sender].push(credentialId);
        subjectCredentials[address(uint160(uint256(subject)))].push(credentialId);
        
        protocolFees[address(0)] = protocolFees[address(0)].add(msg.value);
        totalCredentials = totalCredentials.add(1);
        credentialsIssued[msg.sender] = credentialsIssued[msg.sender].add(1);
        
        // Refund excess fees
        if (msg.value > credentialFee) {
            payable(msg.sender).transfer(msg.value.sub(credentialFee));
        }
        
        emit CredentialIssued(credentialId, msg.sender, subject, credentialHash);
    }

    /**
     * @dev Revoke credential
     */
    function revokeCredential(bytes32 credentialId) external nonReentrant {
        VerifiableCredential storage credential = credentials[credentialId];
        require(credential.issuer == msg.sender, "Not credential issuer");
        require(credential.active, "Credential not active");
        
        credential.revoked = true;
        credential.active = false;
        
        emit CredentialRevoked(credentialId, msg.sender);
    }

    /**
     * @dev Verify credential
     */
    function verifyCredential(bytes32 credentialId) 
        external validDID(bytes32(0)) nonReentrant returns (
            bool valid,
            string memory credentialHash,
            string[] memory attributes,
            string[] memory values,
            address issuer,
            uint256 issuedAt,
            uint256 expiresAt
        ) {
        VerifiableCredential storage credential = credentials[credentialId];
        
        if (credential.issuer == address(0) || credential.revoked || 
            credential.expiresAt < block.timestamp) {
            return (false, "", new string[](0), new string[](0), address(0), 0, 0);
        }
        
        credentialVerifications[credentialId].push(CredentialVerification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            valid: true
        }));
        
        totalVerifications = totalVerifications.add(1);
        credentialsVerified[msg.sender] = credentialsVerified[msg.sender].add(1);
        
        return (
            true,
            credential.credentialHash,
            credential.attributeKeys,
            credential.attributeValues,
            credential.issuer,
            credential.issuedAt,
            credential.expiresAt
        );
    }

    /**
     * @dev Batch verify multiple credentials
     */
    function batchVerifyCredentials(bytes32[] calldata credentialIds) 
        external nonReentrant returns (bool[] memory results) {
        results = new bool[](credentialIds.length);
        
        for (uint256 i = 0; i < credentialIds.length; i++) {
            bytes32 credentialId = credentialIds[i];
            VerifiableCredential storage credential = credentials[credentialId];
            
            if (credential.issuer != address(0) && !credential.revoked && 
                credential.expiresAt >= block.timestamp) {
                results[i] = true;
                credentialVerifications[credentialId].push(CredentialVerification({
                    verifier: msg.sender,
                    timestamp: block.timestamp,
                    valid: true
                }));
                totalVerifications = totalVerifications.add(1);
                credentialsVerified[msg.sender] = credentialsVerified[msg.sender].add(1);
            } else {
                results[i] = false;
            }
        }
    }

    /**
     * @dev Resolve DID
     */
    function resolveDID(bytes32 did) external view returns (
        address owner,
        address[] memory controllers,
        string memory documentHash,
        string[] memory publicKeys,
        string[] memory services,
        uint256 expiry,
        uint256 createdAt,
        uint256 lastUpdated
    ) {
        DIDDocument storage doc = didDocuments[did];
        require(doc.owner != address(0), "DID not found");
        require(block.timestamp <= doc.expiry, "DID expired");
        
        return (
            doc.owner,
            doc.controllers,
            doc.documentHash,
            doc.publicKeys,
            doc.services,
            doc.expiry,
            doc.createdAt,
            doc.lastUpdated
        );
    }

    /**
     * @dev Get DID attributes
     */
    function getDIDAttributes(bytes32 did) external view returns (
        string[] memory keys,
        string[] memory values,
        uint256[] memory expiries,
        bool[] memory active
    ) {
        Attribute[] storage attributes = didAttributes[did];
        uint256 activeCount = 0;
        
        // Count active attributes
        for (uint256 i = 0; i < attributes.length; i++) {
            if (attributes[i].active && block.timestamp <= attributes[i].expiry) {
                activeCount++;
            }
        }
        
        keys = new string[](activeCount);
        values = new string[](activeCount);
        expiries = new uint256[](activeCount);
        active = new bool[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < attributes.length; i++) {
            if (attributes[i].active && block.timestamp <= attributes[i].expiry) {
                keys[index] = attributes[i].key;
                values[index] = attributes[i].value;
                expiries[index] = attributes[i].expiry;
                active[index] = true;
                index++;
            }
        }
    }

    /**
     * @dev Get credentials by issuer
     */
    function getCredentialsByIssuer(address issuer) external view returns (bytes32[] memory) {
        return issuerCredentials[issuer];
    }

    /**
     * @dev Get credentials by subject
     */
    function getCredentialsBySubject(bytes32 subject) external view returns (bytes32[] memory) {
        return subjectCredentials[address(uint160(uint256(subject)))];
    }

    /**
     * @dev Get credential details
     */
    function getCredential(bytes32 credentialId) external view returns (
        bytes32 subject,
        address issuer,
        string memory credentialHash,
        string[] memory attributes,
        string[] memory values,
        uint256 issuedAt,
        uint256 expiresAt,
        bool revoked,
        bool active
    ) {
        VerifiableCredential storage credential = credentials[credentialId];
        return (
            credential.subject,
            credential.issuer,
            credential.credentialHash,
            credential.attributeKeys,
            credential.attributeValues,
            credential.issuedAt,
            credential.expiresAt,
            credential.revoked,
            credential.active
        );
    }

    /**
     * @dev Get user statistics
     */
    function getUserStats(address user) external view returns (
        uint256 didRegistrationsCount,
        uint256 credentialsIssuedCount,
        uint256 credentialsVerifiedCount
    ) {
        return (
            didRegistrations[user],
            credentialsIssued[user],
            credentialsVerified[user]
        );
    }

    /**
     * @dev Update fees
     */
    function updateFees(
        uint256 newRegistrationFee,
        uint256 newAttributeFee,
        uint256 newCredentialFee
    ) external onlyOwner {
        require(newRegistrationFee <= 0.1 ether, "Registration fee too high");
        require(newAttributeFee <= 0.01 ether, "Attribute fee too high");
        require(newCredentialFee <= 0.05 ether, "Credential fee too high");
        
        registrationFee = newRegistrationFee;
        attributeFee = newAttributeFee;
        credentialFee = newCredentialFee;
    }

    /**
     * @dev Update default expiry
     */
    function updateDefaultExpiry(uint256 newExpiry) external onlyOwner {
        require(newExpiry >= 1 days && newExpiry <= 10 * 365 days, "Invalid expiry");
        defaultExpiry = newExpiry;
    }

    /**
     * @dev Update fee recipient
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    /**
     * @dev Withdraw protocol fees
     */
    function withdrawFees(address token, uint256 amount) external {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Not authorized");
        require(protocolFees[token] >= amount, "Insufficient fees");
        
        protocolFees[token] = protocolFees[token].sub(amount);
        
        if (token == address(0)) {
            payable(feeRecipient).transfer(amount);
        } else {
            // Would need IERC20 for non-native token fees
            // IERC20(token).safeTransfer(feeRecipient, amount);
        }
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev View function to get contract statistics
     */
    function getContractStats() external view returns (
        uint256 _totalDIDs,
        uint256 _totalCredentials,
        uint256 _totalVerifications,
        uint256 _registrationFee,
        uint256 _attributeFee,
        uint256 _credentialFee
    ) {
        return (
            totalDIDs,
            totalCredentials,
            totalVerifications,
            registrationFee,
            attributeFee,
            credentialFee
        );
    }

    // Fallback function to receive ETH
    receive() external payable {
        protocolFees[address(0)] = protocolFees[address(0)].add(msg.value);
    }
}
