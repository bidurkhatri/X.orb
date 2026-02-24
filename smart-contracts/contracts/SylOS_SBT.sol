// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title SylOS Soulbound Token (SBT)
 * @dev A non-transferable ERC721 governance and identity token for OpenZeppelin v5.
 * Contains verifiable credentials representing proof-of-productivity milestones.
 */
contract SylOS_SBT is ERC721, ERC721URIStorage, AccessControl {
    uint256 private _nextTokenId = 1;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Mapping from user address to their uniquely held identity Token ID
    mapping(address => uint256) public identityTokenOf;
    // Explicit flag for whether address has an SBT (avoids tokenId==0 ambiguity)
    mapping(address => bool) public hasSBT;
    
    // Mapping from Token ID to an array of Verifiable Credentials JSON URIs
    mapping(uint256 => string[]) private _credentials;

    event CredentialIssued(uint256 indexed tokenId, string credentialURI);
    event SoulboundMinted(address indexed account, uint256 indexed tokenId);

    constructor(address initialAdmin) ERC721("SylOS Identity SBT", "SYLOS-ID") {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, initialAdmin);
        _grantRole(VERIFIER_ROLE, initialAdmin);
    }

    /**
     * @dev Mints a singular identity SBT to a new account.
     * Reverts if the account already owns a token.
     */
    function mintIdentity(address to, string memory uri) public onlyRole(MINTER_ROLE) {
        require(!hasSBT[to], "SylOS_SBT: Address already holds an identity token");
        
        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        identityTokenOf[to] = tokenId;
        hasSBT[to] = true;

        emit SoulboundMinted(to, tokenId);
    }

    /**
     * @dev Issues a Verifiable Credential to a specific Identity Token.
     */
    function issueCredential(uint256 tokenId, string memory credentialURI) public onlyRole(VERIFIER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "SylOS_SBT: Token does not exist");
        
        _credentials[tokenId].push(credentialURI);
        emit CredentialIssued(tokenId, credentialURI);
    }

    /**
     * @dev Retrieves all credentials for a given Identity Token.
     */
    function getCredentials(uint256 tokenId) public view returns (string[] memory) {
        require(_ownerOf(tokenId) != address(0), "SylOS_SBT: Token does not exist");
        return _credentials[tokenId];
    }

    /**
     * @dev Overrides transfer functions to enforce Soulbound (non-transferable) mechanics using OZ v5 `_update`.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Enforce Soulbound non-transferability, unless it's a structural network mutation (minting/burning)
        require(from == address(0) || to == address(0), "SylOS_SBT: Transfer failed. Token is Soulbound.");
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev The following functions are overrides required by Solidity for ERC721URIStorage & AccessControl.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
