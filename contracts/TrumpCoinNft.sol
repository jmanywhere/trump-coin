// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract TrumpCoinNft is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    struct RoundInfo {
        uint256 price;
        uint256 totalBatch;
        uint256 enabled;
        string baseUri;
        bool active;
    }
    mapping(address => mapping(uint8 => uint8)) private mintedAmount;
    mapping(uint8 => RoundInfo) private rounds;
    string private hiddenUri;
    uint public totalSupply;
    uint8 currentRound = 1;
    uint8 public totalRounds = 3;

    event PriceSet(uint8 indexed round, uint price);
    event URISet(uint8 indexed round);
    event ActivateRound(uint8 indexed round);

    constructor() ERC721("Trump Coin NFT", "DTC_NFT") {}

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireMinted(tokenId);
        uint8 idRound = uint8(tokenId / (idsPerRound + 1)) + 1;
        RoundInfo storage round = rounds[idRound];
        if (bytes(round.baseUri).length == 0) {
            return hiddenUri;
        }
        return string(abi.encodePacked(round.baseUri, tokenId.toString()));
    }

    function activateRound(
        uint8 _round,
        uint256 batchAmount,
        uint256 enabledAmount,
        uint256 price
    ) external onlyOwner {
        require(_round <= totalRounds && _round > 0, "Invalid round");
        require(enabledAmount <= batchAmount, "Invalid amounts");
        RoundInfo storage round = rounds[_round];
        round.active = true;
        round.totalBatch = batchAmount;
        round.enabled = enabledAmount;
        round.price = price;
        emit ActivateRound(_round);
    }

    function editPrice(uint8 _round, uint256 price) external onlyOwner {
        require(_round <= totalRounds && _round > 0, "Invalid round");
        rounds[_round].price = price;
    }

    function setRoundURI(uint8 _round, string memory _uri) external onlyOwner {
        require(_round <= totalRounds && _round > 0, "Invalid round");
        RoundInfo storage round = rounds[_round];
        round.baseUri = _uri;
        emit URISet(_round);
    }

    function mint(bool useStable, uint amount) external payable nonReentrant {
        require(amount > 0, "Invalid amount");
        uint8 startRound = getRoundIdForToken(
            totalSupply + 1,
            totalRounds,
            idsPerRound
        );
        uint8 endRound = getRoundIdForToken(
            totalSupply + amount,
            totalRounds,
            idsPerRound
        );

        require(startRound == endRound, "Exceeded round");
        require(
            mintedAmount[msg.sender][startRound] + amount <= 5,
            "Exceeded mint limit"
        );
        require(rounds[startRound].active, "Round not started");
        if (useStable) {
            require(
                usdt.transferFrom(msg.sender, address(this), amount * price)
            );
            require(msg.value == 0, "No ETH plz");
        } else {
            uint decimals = bnbPriceFeed.decimals();
            (, int _price, , , ) = bnbPriceFeed.latestRoundData();
            require(_price > 0, "Invalid price");
            uint reqPrice = (price * (10 ** decimals)) / (uint(_price));
            require(msg.value >= reqPrice * amount, "Insufficient payment");
        }
        for (uint8 i = 0; i < amount; i++) {
            uint _newId = totalSupply + i + 1;
            _safeMint(msg.sender, _newId);
        }
        totalSupply += amount;
        mintedAmount[msg.sender][startRound] += uint8(amount);
    }

    function getRoundIdForToken(
        uint _id,
        uint8 _totalRounds,
        uint16 _perRound
    ) public pure returns (uint8 _actualRound) {
        _actualRound = 0; // Doing this because the return complains, but theoretically it'll never reach this point
        for (uint16 _round = 1; _round <= uint16(_totalRounds); _round++) {
            uint _topId = uint256(_round * _perRound) + 1;
            if (_id < _topId) {
                return uint8(_round);
            }
        }
    }

    function isRoundActive(uint8 _round) external view returns (bool) {
        return rounds[_round].active;
    }

    function extractPayments() external onlyOwner {
        uint ethBalance = address(this).balance;
        uint usdtBalance = usdt.balanceOf(address(this));
        if (ethBalance > 0) {
            (bool succ, ) = payable(owner()).call{value: ethBalance}("");
            require(succ, "Transfer failed");
        }
        if (usdtBalance > 0) require(usdt.transfer(msg.sender, usdtBalance));
    }

    function setHiddenURI(string memory _uri) external onlyOwner {
        require(bytes(hiddenUri).length == 0, "already set");
        hiddenUri = _uri;
    }
}
