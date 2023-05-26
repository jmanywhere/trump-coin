import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from "@web3modal/ethereum";
import { Web3Button, Web3Modal, useWeb3Modal } from "@web3modal/react";
import { useEffect, useMemo, useState } from "react";
import {
  configureChains,
  createClient,
  useAccount,
  useContractInfiniteReads,
  useContractRead,
  useContractReads,
  useContractWrite,
  usePrepareContractWrite,
  WagmiConfig,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { publicProvider } from "wagmi/providers/public";
import flag from "/america.gif";
import logo from "/logo2.jpeg";
import nftAbi from "./data/nftAbi";
import { BigNumber, constants } from "ethers";
import { commify, formatEther, parseEther } from "ethers/lib/utils.js";
import classNames from "classnames";
import flatten from "lodash/flatten";

const nftToken = "0xBdEaE12253b3C8869161a22D125fA565645258e8" as `0x${string}`; // TODO PENDING CHANGE

const chains = [bsc];
const projectId = import.meta.env.VITE_PROJECT_ID;
if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_PROJECT_ID");
}

const { provider } = configureChains(chains, [
  w3mProvider({ projectId }),
  publicProvider(),
  jsonRpcProvider({
    rpc: (chain) => ({
      http: chain.id == 56 ? "https://bscrpc.com" : "",
    }),
  }),
]);
const wagmiClient = createClient({
  autoConnect: true,
  connectors: w3mConnectors({ projectId, version: 1, chains }),
  provider,
});
const ethereumClient = new EthereumClient(wagmiClient, chains);

function App() {
  return (
    <>
      <WagmiConfig client={wagmiClient}>
        <main className="relative flex flex-col w-screen min-h-screen bg-gray-200 overflow-hidden">
          <img
            src={flag}
            className="absolute -top-[100%] left-0 w-[300%] h-[300%] object-cover"
          />
          <header className="w-full bg-slate-900 shadow-2xl z-10">
            <div className="container py-2 mx-auto px-4 flex flex-row items-center justify-between">
              <a
                href="https://trumpcoindtc.com/"
                target="_blank"
                className="text-sm md:text-2xl uppercase font-bold font-spartan text-white pt-1"
              >
                TrumpCoin Universe NFT
              </a>
              <Web3Button />
            </div>
          </header>
          <div className="flex flex-col flex-grow items-center justify-center container mx-auto pb-8 gap-y-8">
            <DataLayer />
          </div>
        </main>
      </WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </>
  );
}

export default App;

const DataLayer = () => {
  const { address } = useAccount();

  const { data } = useContractReads({
    contracts: [
      {
        address: nftToken,
        abi: nftAbi,
        functionName: "totalSupply",
      },
      {
        address: nftToken,
        abi: nftAbi,
        functionName: "balanceOf",
        args: [address || constants.AddressZero],
      },
      {
        address: nftToken,
        abi: nftAbi,
        functionName: "currentRound",
      },
    ],
    watch: true,
  });

  const {
    data: owners,
    fetchNextPage,
    refetch,
    isLoading,
    isRefetching,
  } = useContractInfiniteReads({
    cacheKey: "ownerOfTokens",
    contracts: (pageParam: number) => {
      const baseParam = pageParam || 1;
      const allRequests = 30;
      const baseParams = {
        abi: nftAbi,
        address: nftToken,
        functionName: "ownerOf",
      };
      const allCalls = Array.from({ length: allRequests }, (_, i) => ({
        ...baseParams,
        args: [baseParam + i],
      }));
      return allCalls;
    },
    getNextPageParam(_, pages) {
      return pages.length * 20 + 1;
    },
    enabled: data?.[1]?.gt(0),
  });
  useEffect(() => {
    if (data?.[0]?.isZero() ?? true) return;
    const maxPages = data?.[0]?.div(30).gt(0)
      ? data?.[0]?.div(30).add(1).toNumber()
      : 1;
    if (
      (owners?.pages.length || 0) > 0 &&
      (owners?.pages.length || 0) < maxPages
    ) {
      console.log("called fetch");
      void fetchNextPage();
    }
  }, [fetchNextPage, owners, data]);

  const ownedNFTs: number[] = useMemo(() => {
    if (owners?.pages.length === 0 || !owners?.pages) return [] as number[];
    const ids = (owners.pages as Array<Array<`0x${string}`>>).reduce(
      (acc, page, pageIndex: number) => {
        const owned: number[] = [];
        page.map((owner, addressIndex) => {
          if (owner === address)
            owned.push(pageIndex * 20 + (addressIndex + 1));
        });
        return [...acc, ...owned];
      },
      [] as number[]
    );
    if (ids.length / 3 > 1) {
      const tempIds: Array<number | number[]> = ids.map((id, index) => {
        if ((index + 1) % 3 === 0) return [id, 0];
        else return id;
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const flatIds: number[] = flatten<number | number[]>(tempIds) as number[];
      return flatIds;
    }
    return ids;
  }, [owners, address]);

  return (
    <>
      <MintCard
        totalSupply={data?.[0]?.toString() || "-"}
        currentRound={data?.[2]?.toString() || "-"}
      />
      <OwnedCard
        refresh={refetch}
        isFetching={isLoading || isRefetching}
        owned={ownedNFTs}
      />
    </>
  );
};

const MintCard = (props: { totalSupply: string; currentRound: string }) => {
  const { totalSupply, currentRound } = props;
  const [amount, setAmount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const { address } = useAccount();
  const { open } = useWeb3Modal();

  const { config: mintBNBConfig, error: configError } = usePrepareContractWrite(
    {
      address: nftToken,
      abi: nftAbi,
      functionName: "mint",
      args: [
        BigNumber.from(
          isNaN(parseInt(amount.toString())) ? "0" : amount.toString()
        ),
      ],
      overrides: {
        value:
          parseEther(
            BigNumber.from(
              isNaN(parseInt(amount.toString())) ? "0" : amount.toString()
            ).toString()
          ).mul(parseEther("0.4")) || // divide to the .05% wiggle room // divide by price to get approx bnb price
          0,
      },
      enabled: !!address,
    }
  );
  const { writeAsync: mintWithBnb } = useContractWrite(mintBNBConfig);

  const parsedJsonStack = useMemo(() => {
    if (!configError?.stack) return "";
    const startIndex = configError.stack.indexOf("{");
    const endIndex = configError.stack.lastIndexOf("}");
    if (startIndex !== -1 && endIndex !== -1) {
      const jsonString = configError.stack.substring(startIndex, endIndex + 1);

      try {
        const jsonObject = JSON.parse(jsonString);
        const actualError = jsonObject?.data?.message;
        const cutMsgIndex = actualError?.indexOf("*") ?? -1;
        if (cutMsgIndex == -1) {
          return actualError || "";
        }
        return actualError.substring(0, cutMsgIndex) || "";
      } catch (error) {
        console.error("Error parsing JSON:", error);
        return "";
      }
    } else {
      console.error("JSON object not found in the string.");
      return "";
    }
  }, [configError]);
  return (
    <div className="card w-96 max-w-[80%] bg-base-100 shadow-xl border-2 border-primary shadow-secondary mx-4 my-12 lg:my-0 overflow-hidden">
      <div className="card-body px-0 pt-0 items-center text-center ">
        <h1 className="text-accent card-title font-spartan text-2xl bg-black/90 w-full flex flex-row items-center justify-center py-6 px-4">
          <div className="rounded-full overflow-hidden w-[80px] h-[80px]">
            <img src={logo} className="w-[80px] h-[80px]" />
          </div>
          <div className="text-white/90 whitespace-pre-wrap text-center">
            TrumpCoin{"\n"}Universe
          </div>
          <div className="rounded-full overflow-hidden w-[80px] h-[80px]">
            <img src={logo} className="w-[80px] h-[80px]" />
          </div>
        </h1>
        <h2 className="w-full text-center block text-xl font-bold text-accent-focus font-old">
          Unique Trump NFTs
        </h2>
        <p className="text-justify whitespace-pre-wrap font-spartan px-12 ">
          NFTs will collect fees in USDT and users will be able to claim them
          directly from their NFT.
          {"\n"}
        </p>
        <div className="grid grid-cols-5 grid-rows-3 justify-between font-old">
          <div className="text-left col-span-3">Current Round:</div>{" "}
          <div className=" text-accent ml-auto col-span-2">{currentRound}</div>
          <div className="text-left col-span-3">Max Per Wallet:</div>{" "}
          <div className=" text-accent ml-auto col-span-2">5</div>
          <div className="text-left col-span-3">Total Minted:</div>{" "}
          <div className=" text-accent ml-auto col-span-2">{totalSupply}</div>
          <div className="text-left col-span-3">Price: </div>
          <div className=" text-accent ml-auto col-span-2">0.4 BNB</div>
        </div>
        <input
          type="number"
          min={1}
          max={5}
          value={amount}
          placeholder="Amount to be minted"
          onChange={(e) => {
            const newNum = e.target.valueAsNumber;
            if (newNum > 5 || newNum < 1 || isNaN(newNum)) {
              setAmount("");
              return;
            }
            setAmount(newNum);
          }}
          className="input w-60 input-bordered input-primary "
        />
        {configError && typeof amount == "number" && amount > 0 && (
          <div className="text-error text-center text-xs">
            {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              //@ts-ignore
              configError.error?.data?.message ||
                parsedJsonStack ||
                "Something wrong"
            }
          </div>
        )}
        <div className="card-actions justify-center pt-4">
          <button
            className={classNames(
              "btn btn-secondary text-white/90",
              loading ? "btn-disabled" : ""
            )}
            onClick={() => {
              if (!address) {
                open();
                return;
              }
              if (!mintWithBnb) return;
              setLoading(true);
              void mintWithBnb()
                .then(
                  async (r) =>
                    await r.wait().then((r) => {
                      console.log("receipt", r);
                      setAmount("");
                      setLoading(false);
                    })
                )
                .finally(() => setLoading(false));
            }}
          >
            Mint
          </button>
        </div>
      </div>
    </div>
  );
};

const OwnedCard = (props: {
  refresh: () => void | Promise<unknown>;
  owned: Array<number>;
  isFetching?: boolean;
}) => {
  const { refresh, owned, isFetching } = props;
  const { data } = useContractRead({
    address: nftToken,
    abi: nftAbi,
    functionName: "getTotalPendingRewards",
    args: [owned.map((id) => BigNumber.from(id.toString()))],
    enabled: owned.length > 0,
  });

  const { config } = usePrepareContractWrite({
    address: nftToken,
    abi: nftAbi,
    functionName: "claimMultiple",
    args: [owned.map((id) => BigNumber.from(id.toString()))],
    enabled: owned.length > 0,
  });
  const { writeAsync: claim, error } = useContractWrite(config);
  if (owned.length == 0) return null;
  return (
    <div className="card w-96 max-w-[80%] bg-base-100 shadow-xl border-2 border-primary shadow-secondary mx-4 my-12 lg:my-0 overflow-hidden px-8 py-4">
      <div className="flex flex-row justify-between items-center pb-4">
        <h2 className="text-xl font-spartan font-bold">NFTs Owned</h2>
        <button
          className={classNames(
            "btn btn-primary btn-sm",
            isFetching ? "btn-disabled" : ""
          )}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-y-8">
        {owned.map((id) => (
          <li key={id}>
            <a
              className="link link-primary"
              href={`https://opensea.io/assets/bsc/${nftToken}/${id}`}
              title={`Open #${id} on OpenSea`}
            >
              View #{id}
            </a>
          </li>
        ))}
      </ul>
      <div className="whitespace-pre-wrap text-center py-4">
        Pending Rewards to Claim:{"\n"}
        {commify(formatEther(data || BigNumber.from(0)))}
      </div>
      {data && data.gt(0) && (
        <div
          className="flex flex-row justify-center"
          onClick={() => claim && claim()}
        >
          <button className="btn btn-accent ">Claim</button>
        </div>
      )}
    </div>
  );
};
