from ape import project, reverts, Contract
from pytest import fixture

usdt_address = "0x55d398326f99059fF775485246999027B3197955"


@fixture
def setup(accounts):
    owner = accounts[0]
    nft = project.TrumpCoinUniverseNFT.deploy(usdt_address, sender=owner)
    usdt = Contract(usdt_address)
    usdt_whale = accounts["0x4b16c5de96eb2117bbe5fd171e4d203624b014aa"]
    return owner, nft, usdt, usdt_whale


def test_activate_round(setup, accounts):
    owner, nft, *_ = setup
    with reverts("Invalid amount"):
        nft.activateNextRound(0, 0, 0, sender=owner)

    nft.activateNextRound(300, int(1e18 * 0.5), 100, sender=owner)

    with reverts("Previous round not over"):
        nft.activateNextRound(300, int(1e18 * 0.5), 100, sender=owner)

    assert nft.isRoundActive(2) == False
    assert nft.isRoundActive(1) == True
    assert nft.isRoundActive(0) == False
    pass


def test_mint(setup, accounts):
    owner, nft, usdt, usdt_whale = setup

    nft_price = int(1e18 * 0.5)

    mint_amount = 5
    mint_value = mint_amount * nft_price
    mint_amount_2 = 4
    mint_value_2 = mint_amount_2 * nft_price

    user1 = accounts[1]
    user2 = accounts[2]
    # Round not started
    with reverts("Not enabled"):
        nft.mint(mint_amount, sender=user1, value=mint_value)
    nft.activateNextRound(300, nft_price, 100, sender=owner)
    # Successful mint
    nft.mint(mint_amount, sender=user1, value=mint_value)
    assert nft.balanceOf(user1) == mint_amount
    # Mint limit
    with reverts("Exceeded mint limit"):
        nft.mint(mint_amount_2, sender=user1, value=mint_value_2)

    assert nft.totalSupply() == mint_amount
    with reverts():
        nft.ownerOf(0)
    assert nft.ownerOf(1) == user1.address
    assert nft.ownerOf(2) == user1.address
    assert nft.ownerOf(3) == user1.address
    assert nft.ownerOf(4) == user1.address
    assert nft.ownerOf(5) == user1.address

    pass

def test_mint_next_round(setup, accounts):
    owner, nft, usdt, usdt_whale = setup

    mint_amount = 5
    nft_price = int(1e18 * 0.5)
    mint_value = mint_amount * nft_price

    user1 = accounts[1]
    user2 = accounts[2]
    user3 = accounts[3]

    nft.activateNextRound(10, nft_price, 100, sender=owner)
    nft.mint(mint_amount, sender=user1, value=mint_value)
    nft.mint(mint_amount, sender=user2, value=mint_value)

    with reverts("Exceeded mint limit"):
        nft.mint(mint_amount, sender=user3, value=mint_value)

    nft.activateNextRound(10, nft_price, 100, sender=owner)
    # Users are able to continue minting on round 2
    nft.mint(mint_amount, sender=user1, value=mint_value)
    nft.mint(mint_amount, sender=user2, value=mint_value)

    assert nft.totalSupply() == 20
    pass


def test_uri(setup, accounts):
    owner, nft, usdt, usdt_whale = setup

    mint_amount = 1
    nft_price = int(1e18 * 0.5)
    mint_value = mint_amount * nft_price

    user1 = accounts[1]
    nft.activateNextRound(300, nft_price, 100, sender=owner)

    nft.mint(mint_amount, sender=user1, value=mint_value)

    assert nft.tokenURI(1) == ""
    nft.setHiddenURI("https://example.com", sender=owner)
    assert nft.tokenURI(1) == "https://example.com"
    with reverts("ERC721: invalid token ID"):
        nft.tokenURI(0)

    nft.setRoundURI(1, "https://ex2.com/", sender=owner)
    assert nft.tokenURI(1) == "https://ex2.com/1"


def test_reward_distribution(setup, accounts, chain):
    owner, nft, usdt, usdt_whale = setup

    mint_amount = 1
    nft_price = int(1e18 * 0.5)
    mint_value = mint_amount * nft_price

    user1 = accounts[1]

    nft.activateNextRound(5, nft_price, 100, sender=owner)

    nft.mint(mint_amount, sender=user1, value=mint_value)
    assert nft.getPendingRewards(1) == 0
    chain.mine(deltatime=7200)
    current_pending = nft.getPendingRewards(1)
    assert current_pending == 3601 * nft_price * int(310e18) // (365*24*3600 * int(1e18))
    with reverts(nft.InsufficientRewardBalance):
        nft.claimDividend(1, sender=user1)
    usdt.transfer(nft.address, int(1e18), sender=usdt_whale)
    nft.claimDividend(1, sender=user1)
    assert nft.getPendingRewards(1) == 0
    assert usdt.balanceOf(user1) > current_pending # Some extra seconds passed so the claimed value should be slightly higher
    chain.mine(deltatime=4*24*3600)
    nft.claimDividend(1, sender=user1)
    assert usdt.balanceOf(nft.address) == 0
    df = nft.DividendClaimed.query("event_arguments", start_block=-1).event_arguments[0]
    # Get the data values from DataFrame df
    assert df["amountPending"] > 0
    pass