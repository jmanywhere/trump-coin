// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

error InsufficientRewardBalance();

contract TrumpCoinNft is ERC721, ERC2981, Ownable, ReentrancyGuard {
    using Strings for uint256;
    struct RoundInfo {
        uint256 price; //  this will always be in BNB
        uint256 apy;
        uint256 lastRoundMaxId;
        uint256 totalBatch; // Total amount of batch
        uint256 pendingMint; // Amount pending to mint
        string baseUri;
        bool active;
    }
    struct TokenRewardInfo {
        uint256 lastClaim;
        uint256 rewardsCollected;
        uint256 pendingCollection;
        uint8 round;
    }
    mapping(address => mapping(uint8 => uint8)) private mintedAmount;
    mapping(uint256 => TokenRewardInfo) private _tokenRound;
    mapping(uint8 => RoundInfo) private rounds;
    uint public constant MAGNIFIER = 1e8;
    uint256 public constant BNB_PRICE = 310 ether;
    uint256 public constant APY_BASE = 100;
    IERC20 public USDT;
    uint256 public totalSupply;
    string private hiddenUri;
    string public contractURI;
    uint8 public currentRound = 0;

    event PriceSet(uint8 indexed round, uint price);
    event URISet(uint8 indexed round);
    event ActivateRound(uint8 indexed round);
    event DividendsToDistribute(uint amount);
    event DividendClaimed(uint id, uint amountClaimed, uint amountPending);

    /**
     * @notice contructor function
     * @param _USDT the USDT token address
     */
    constructor(address _USDT) ERC721("TrumpCoin Universe", "TCU") {
        USDT = IERC20(_USDT);
    }

    /**
     * @notice Get the appropriate metadata for the specific tokenId
     * @param tokenId The token ID to get the metadata info for.
     * @dev Requires that token is already minted, otherwise it'll fail.
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireMinted(tokenId);
        uint8 idRound = _tokenRound[tokenId].round;
        RoundInfo storage round = rounds[idRound];
        if (bytes(round.baseUri).length == 0) {
            return hiddenUri;
        }
        return string(abi.encodePacked(round.baseUri, tokenId.toString()));
    }

    /**
     * @param batchAmount Total amount of NFTs that this round will have
     * @param price Price in ETH of each NFT
     * @param apy The APY return promised to the users APY_BASE is 100, so doing 110% APY means it needs to be 110.
     * @dev current rounds needs to be over for this to work.
     */
    function activateNextRound(
        uint256 batchAmount,
        uint256 price,
        uint256 apy
    ) external onlyOwner {
        require(
            rounds[currentRound].pendingMint == 0,
            "Previous round not over"
        );
        require(batchAmount > 0, "Invalid amount");
        currentRound++;
        RoundInfo storage round = rounds[currentRound];
        round.active = true;
        round.totalBatch = batchAmount;
        round.pendingMint = batchAmount;
        round.price = price;
        round.apy = apy;
        emit ActivateRound(currentRound);
    }

    /**
     * @param _round The specific round to change the price from
     * @param price The new specified price in ETH (18 decimals please)
     * @dev main requirement is that no NFTs have been sold this round.
     */
    function editPrice(uint8 _round, uint256 price) external onlyOwner {
        RoundInfo memory selectedRound = rounds[_round];
        require(
            selectedRound.active &&
                selectedRound.totalBatch == selectedRound.pendingMint,
            "Invalid edit"
        );
        rounds[_round].price = price;
    }

    /**
     * @notice Sets the URI for a specific round
     * @param _round The ID of the round to update URI
     * @param _uri The new URI for the metadata
     */
    function setRoundURI(uint8 _round, string memory _uri) external onlyOwner {
        RoundInfo memory selectedRound = rounds[_round];
        require(selectedRound.active, "Invalid round");
        rounds[_round].baseUri = _uri;
        emit URISet(_round);
    }

    /**
     * @notice Mint your NFT with this function
     * @param amount Amount of NFTs to mint
     * @dev Users can only mint 5 NFTs per round
     */
    function mint(uint amount) external payable nonReentrant {
        RoundInfo storage cR = rounds[currentRound];
        require(cR.active, "Not enabled");
        require(
            mintedAmount[msg.sender][currentRound] + amount <= 5 &&
                cR.pendingMint >= amount,
            "Exceeded mint limit"
        );
        cR.pendingMint -= amount;
        require(msg.value >= cR.price * amount, "Insufficient payment");
        for (uint8 i = 0; i < amount; i++) {
            uint _newId = totalSupply + i + 1;
            _safeMint(msg.sender, _newId);
            _tokenRound[_newId] = TokenRewardInfo(
                block.timestamp + 1 hours,
                0,
                0,
                currentRound
            );
        }
        totalSupply += amount;
        mintedAmount[msg.sender][currentRound] += uint8(amount);
    }

    /**
     * @notice check wether the round is active for minting
     * @param _round Round ID to check
     */
    function isRoundActive(uint8 _round) external view returns (bool) {
        return rounds[_round].active;
    }

    /**
     * @notice Transfer all ETH in the contract to owner wallet.
     * @dev for ERC20 tokens, use getStuckERC function
     */
    function extractPayments() external onlyOwner {
        uint ethBalance = address(this).balance;
        if (ethBalance > 0) {
            (bool succ, ) = payable(msg.sender).call{value: ethBalance}("");
            require(succ, "Transfer failed");
        }
    }

    /**
     * @notice Transfer the ERC20 tokens from this contract to the owner.
     * @param _token The address of ERC20 token to extract from contract.
     * @dev if ETH is stuck, use extract Payments
     */
    function getStuckERC(address _token) external onlyOwner nonReentrant {
        require(_token != address(USDT), "Cant retrieve rewards");
        IERC20 stuckToken = IERC20(_token);
        uint balance = stuckToken.balanceOf(address(this));
        if (balance > 0)
            require(
                stuckToken.transfer(msg.sender, balance),
                "Invalid transfer"
            );
    }

    /**
     * @param _uri The URI of the Hidden image/metadata
     */
    function setHiddenURI(string memory _uri) external onlyOwner {
        require(bytes(hiddenUri).length == 0, "already set");
        hiddenUri = _uri;
    }

    /**
     * @notice Only claims the rewards of 1 tokenID.
     * @param tokenId The token ID to claim rewards of.
     * @dev Read implementation on _claim
     */
    function claimDividend(uint tokenId) external nonReentrant {
        _claim(tokenId);
    }

    /**
     * @notice this claims multiple tokenIds
     * @param tokenIds Array of ids to claim rewards from
     * @dev read implementation of each single claim on _claim, however it is NOT gas efficient as it just loops through all IDS
     */
    function claimMultiple(uint[] calldata tokenIds) external nonReentrant {
        for (uint i = 0; i < tokenIds.length; i++) {
            _claim(tokenIds[i]);
        }
    }

    /**
     * @notice This is the base function to claim rewards, it has all the checks necessary to operate.
     * @param tokenId The id of the token to claim the rewards for
     * @dev the only reason this is separate is to able to call this exact same code with both claimDividend and claimMultiple separately, as only doing claimDividend would remove reusability due to reentrancy guard.
     */
    function _claim(uint tokenId) private {
        _requireMinted(tokenId);
        require(ownerOf(tokenId) == msg.sender, "Not owner");

        uint pending = getPendingRewards(tokenId);
        uint rewardBalance = USDT.balanceOf(address(this));
        if (rewardBalance == 0) {
            revert InsufficientRewardBalance();
        }
        _tokenRound[tokenId].lastClaim = block.timestamp;
        if (rewardBalance < pending) {
            _tokenRound[tokenId].pendingCollection = pending - rewardBalance;
            pending = rewardBalance;
        }
        USDT.transfer(msg.sender, pending);
        emit DividendClaimed(
            tokenId,
            pending,
            _tokenRound[tokenId].pendingCollection
        );
    }

    /**
     * @notice get the pending rewards for a specific tokenId
     * @param tokenId The id to check rewards for
     * @return the pending reward for that specific tokenID
     */
    function getPendingRewards(uint tokenId) public view returns (uint) {
        TokenRewardInfo memory reward = _tokenRound[tokenId];
        RoundInfo memory roundInfo = rounds[reward.round];
        return
            _pendingRewards(
                reward.lastClaim,
                block.timestamp,
                roundInfo.apy,
                roundInfo.price
            ) + reward.pendingCollection;
    }

    /**
     * @notice Calculate the sum of a large amount of token Ids. This is to only be used on the frontend.
     * @param tokenIds Array of tokenIds to calculate bulk pending rewards.
     * @return rewards - the sum of the total rewards for all the selected Ids
     */
    function getTotalPendingRewards(
        uint[] calldata tokenIds
    ) external view returns (uint rewards) {
        for (uint i = 0; i < tokenIds.length; i++) {
            rewards += getPendingRewards(tokenIds[i]);
        }
    }

    /**
     * @notice calculate the pendingRewards for a timedifference
     * @param prevTime the last claim time of the user
     * @param currentTime this should be used strictly with block.timestamp
     * @param apy the promised APY of the Collection batch
     * @param mintPrice the mintPrice of the Batch
     * @return result - The result of the math made.
     * @dev use this when calculating rewards
     **/
    function _pendingRewards(
        uint prevTime,
        uint currentTime,
        uint apy,
        uint mintPrice
    ) private pure returns (uint result) {
        if (currentTime <= prevTime) return 0;
        uint diff = currentTime - prevTime;
        result =
            (diff * mintPrice * BNB_PRICE * apy) /
            (365 days * 1 ether * APY_BASE);
    }

    /**
     * @notice Override of implementation by ERC2981 & 721
     * @param interfaceId Interface ID to check if implementation is supported
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC2981) returns (bool) {
        return
            ERC2981.supportsInterface(interfaceId) ||
            ERC721.supportsInterface(interfaceId);
    }

    /**
     * @notice Change royalty for Marketplaces that implement ERC2981 standard
     * @param _newReceiver Who is the receiver of the royalty
     * @param _newFee fee of the royalty, base of royalty is 100_00
     */
    function changeRoyalty(
        address _newReceiver,
        uint96 _newFee
    ) external onlyOwner {
        require(_newFee <= 2500, "Royalty too high"); // Royalty fee must not be greater than 25%
        _setDefaultRoyalty(_newReceiver, _newFee);
    }

    /**
     * @param _newURI URI of the collection itself, Marketplaces like OpenSea allow thi URI to exist to give more details for a specific collection
     */
    function setContractURI(string memory _newURI) external onlyOwner {
        require(bytes(contractURI).length == 0, "Already set");
        contractURI = _newURI;
    }
}
