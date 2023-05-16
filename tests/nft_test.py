from ape import project, reverts, Contract
from pytest import fixture

price_feed_bnb = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE"
usdt_address = "0x55d398326f99059fF775485246999027B3197955"


@fixture
def setup(accounts):
    owner = accounts[0]
    nft = project.TrumpCeoNft.deploy(price_feed_bnb, 10, sender=owner)
    feed = Contract(price_feed_bnb)
    round_data = feed.latestRoundData()
    usdt = Contract(usdt_address)
    usdt_whale = accounts["0x4b16c5de96eb2117bbe5fd171e4d203624b014aa"]
    return owner, nft, round_data, usdt, usdt_whale


def test_activate_round(setup, accounts):
    owner, nft, round_data, usdt, usdt_whale = setup
    with reverts("Invalid round"):
        nft.activateRound(0, sender=owner)
    nft.activateRound(1, sender=owner)

    assert nft.isRoundActive(2) == False
    assert nft.isRoundActive(1) == True
    assert nft.isRoundActive(0) == False
    pass


def test_mint(setup, accounts):
    owner, nft, round_data, usdt, usdt_whale = setup

    mint_amount = 5
    mint_value = int(mint_amount * 100 * (1e18) * 1e8 * 1.005 / round_data["answer"])
    mint_amount_2 = 4
    mint_value_2 = int(
        mint_amount_2 * 100 * (1e18) * 1e8 * 1.005 / round_data["answer"]
    )

    user1 = accounts[1]
    user2 = accounts[2]
    # Round not started
    with reverts("Round not started"):
        nft.mint(False, mint_amount, sender=user1, value=mint_value)
    nft.activateRound(1, sender=owner)
    # Successful mint
    nft.mint(False, mint_amount, sender=user1, value=mint_value)
    assert nft.balanceOf(user1) == mint_amount
    # Mint limit
    with reverts("Exceeded mint limit"):
        nft.mint(False, mint_amount_2, sender=user1, value=mint_value_2)

    assert nft.totalSupply() == mint_amount
    with reverts():
        nft.ownerOf(0)
    assert nft.ownerOf(1) == user1.address
    assert nft.ownerOf(2) == user1.address
    assert nft.ownerOf(3) == user1.address
    assert nft.ownerOf(4) == user1.address
    assert nft.ownerOf(5) == user1.address

    # usdt send from whale to user2 and approve usdt to spend by NFT
    nft_price = 100 * int(1e18)
    usdt.transfer(user2.address, 5 * nft_price, sender=usdt_whale)
    usdt.approve(nft.address, 5 * nft_price, sender=user2)
    with reverts("No ETH plz"):
        nft.mint(True, 5, sender=user2, value=100)
    nft.mint(True, 5, sender=user2)
    pass


def test_mint_next_round(setup, accounts):
    owner, nft, round_data, usdt, usdt_whale = setup

    mint_amount = 5
    mint_value = int(mint_amount * 100 * (1e18) * 1e8 * 1.005 / round_data["answer"])

    user1 = accounts[1]
    user2 = accounts[2]
    user3 = accounts[3]

    nft.activateRound(1, sender=owner)
    nft.mint(False, mint_amount, sender=user1, value=mint_value)
    nft.mint(False, mint_amount, sender=user2, value=mint_value)

    with reverts("Round not started"):
        nft.mint(False, mint_amount, sender=user3, value=mint_value)

    nft.activateRound(2, sender=owner)
    # Users are able to continue minting on round 2
    nft.mint(False, mint_amount, sender=user1, value=mint_value)
    nft.mint(False, mint_amount, sender=user2, value=mint_value)


def test_uri(setup, accounts):
    owner, nft, round_data, usdt, usdt_whale = setup

    mint_amount = 1
    mint_value = int(mint_amount * 100 * (1e18) * 1e8 * 1.005 / round_data["answer"])

    user1 = accounts[1]
    nft.activateRound(1, sender=owner)

    nft.mint(False, mint_amount, sender=user1, value=mint_value)

    assert nft.tokenURI(1) == ""
    nft.setHiddenURI("https://example.com", sender=owner)
    assert nft.tokenURI(1) == "https://example.com"
    with reverts("ERC721: invalid token ID"):
        nft.tokenURI(0)

    nft.setRoundURI(1, "https://ex2.com/", sender=owner)
    assert nft.tokenURI(1) == "https://ex2.com/1/metadata.json"
