// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SolvencyReportAnchorRegistry is Ownable {
    struct AnchorRecord {
        bytes32 reportIdHash;
        bytes32 snapshotIdHash;
        uint256 reportChainId;
        uint256 anchoredAt;
        address anchorer;
        bool exists;
    }

    mapping(bytes32 => AnchorRecord) private anchorRecords;
    address public authorizedAnchorer;

    event AuthorizedAnchorerUpdated(
        address indexed previousAuthorizedAnchorer,
        address indexed nextAuthorizedAnchorer
    );
    event SolvencyReportAnchored(
        bytes32 indexed anchorPayloadHash,
        bytes32 indexed reportIdHash,
        bytes32 indexed snapshotIdHash,
        uint256 reportChainId,
        address anchorer,
        uint256 anchoredAt
    );

    error InvalidAnchorPayloadHash();
    error InvalidReportIdHash();
    error InvalidSnapshotIdHash();
    error InvalidReportChainId();
    error InvalidAuthorizedAnchorer();
    error AnchorAlreadyRecorded();
    error AnchorNotRecorded();

    constructor(address initialOwner, address initialAuthorizedAnchorer)
        Ownable(initialOwner)
    {
        if (initialAuthorizedAnchorer == address(0)) {
            revert InvalidAuthorizedAnchorer();
        }

        authorizedAnchorer = initialAuthorizedAnchorer;
    }

    modifier onlyAuthorizedAnchorerOrOwner() {
        if (msg.sender != authorizedAnchorer && msg.sender != owner()) {
            revert InvalidAuthorizedAnchorer();
        }

        _;
    }

    function setAuthorizedAnchorer(address nextAuthorizedAnchorer)
        external
        onlyOwner
    {
        if (nextAuthorizedAnchorer == address(0)) {
            revert InvalidAuthorizedAnchorer();
        }

        address previousAuthorizedAnchorer = authorizedAnchorer;
        authorizedAnchorer = nextAuthorizedAnchorer;

        emit AuthorizedAnchorerUpdated(previousAuthorizedAnchorer, nextAuthorizedAnchorer);
    }

    function anchorSolvencyReport(
        bytes32 anchorPayloadHash,
        bytes32 reportIdHash,
        bytes32 snapshotIdHash,
        uint256 reportChainId
    ) external onlyAuthorizedAnchorerOrOwner {
        if (anchorPayloadHash == bytes32(0)) {
            revert InvalidAnchorPayloadHash();
        }

        if (reportIdHash == bytes32(0)) {
            revert InvalidReportIdHash();
        }

        if (snapshotIdHash == bytes32(0)) {
            revert InvalidSnapshotIdHash();
        }

        if (reportChainId == 0) {
            revert InvalidReportChainId();
        }

        if (anchorRecords[anchorPayloadHash].exists) {
            revert AnchorAlreadyRecorded();
        }

        uint256 anchoredAt = block.timestamp;

        anchorRecords[anchorPayloadHash] = AnchorRecord({
            reportIdHash: reportIdHash,
            snapshotIdHash: snapshotIdHash,
            reportChainId: reportChainId,
            anchoredAt: anchoredAt,
            anchorer: msg.sender,
            exists: true
        });

        emit SolvencyReportAnchored(
            anchorPayloadHash,
            reportIdHash,
            snapshotIdHash,
            reportChainId,
            msg.sender,
            anchoredAt
        );
    }

    function getAnchorRecord(bytes32 anchorPayloadHash)
        external
        view
        returns (
            bytes32 reportIdHash,
            bytes32 snapshotIdHash,
            uint256 reportChainId,
            uint256 anchoredAt,
            address anchorer
        )
    {
        AnchorRecord memory record = anchorRecords[anchorPayloadHash];

        if (!record.exists) {
            revert AnchorNotRecorded();
        }

        return (
            record.reportIdHash,
            record.snapshotIdHash,
            record.reportChainId,
            record.anchoredAt,
            record.anchorer
        );
    }

    function isAnchored(bytes32 anchorPayloadHash) external view returns (bool) {
        return anchorRecords[anchorPayloadHash].exists;
    }
}
