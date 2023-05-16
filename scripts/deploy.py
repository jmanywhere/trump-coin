from ape import project, accounts

price_feed_bnb = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE"


def main():
    owner = accounts.load("deployment")
    nft = project.TrumpCeoNft.deploy(
        price_feed_bnb, 1000, sender=owner, type=0, publish=True
    )

    print(f"NFT minted at {nft.address}")
