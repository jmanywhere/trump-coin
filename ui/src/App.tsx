import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from "@web3modal/ethereum";
import { Web3Button, Web3Modal, useWeb3Modal } from "@web3modal/react";
import { useMemo, useState } from "react";
import {
  configureChains,
  createClient,
  useAccount,
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
import { parseEther } from "ethers/lib/utils.js";
import classNames from "classnames";

const nftToken = "0xBdEaE12253b3C8869161a22D125fA565645258e8"; // TODO PENDING CHANGE

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
            <MintCard />
            <OwnedCard />
          </div>
        </main>
      </WagmiConfig>
      <Web3Modal projectId={projectId} ethereumClient={ethereumClient} />
    </>
  );
}

export default App;

const MintCard = () => {
  const [amount, setAmount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const { address } = useAccount();
  const { open } = useWeb3Modal();
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
  const { writeAsync: mintWithBnb, error } = useContractWrite(mintBNBConfig);

  console.log({ error, configError });

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
          <div className=" text-accent ml-auto col-span-2">
            {data?.[2]?.toString() || "-"}
          </div>
          <div className="text-left col-span-3">Max Per Wallet:</div>{" "}
          <div className=" text-accent ml-auto col-span-2">5</div>
          <div className="text-left col-span-3">Total Minted:</div>{" "}
          <div className=" text-accent ml-auto col-span-2">
            {data?.[0]?.toString() || "-"}
          </div>
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

const OwnedCard = () => {
  return (
    <div className="card w-96 max-w-[80%] bg-base-100 shadow-xl border-2 border-primary shadow-secondary mx-4 my-12 lg:my-0 overflow-hidden px-8 py-4">
      <div className="flex flex-row justify-between items-center pb-4">
        <h2 className="text-xl font-spartan font-bold">NFTs Owned</h2>
        <button className="btn btn-primary btn-sm">Refresh</button>
      </div>
    </div>
  );
};
