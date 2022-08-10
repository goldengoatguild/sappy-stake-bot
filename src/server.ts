import Web3 from "web3";
import sappySeals from "../abi/sappySeals.json";
import stakeSeals from "../abi/stakeSeals.json";
import { readWatermark, writeWatermark } from "./db";
import { tweet } from "./twitter";

const stakingContractAddress = "0xdf8A88212FF229446e003f8f879e263D3616b57A";
const totalSeals = 10_000;
const threshold = 25;

const { INFURA_WSS_ENDPOINT } = process.env;

const provider = new Web3.providers.WebsocketProvider(INFURA_WSS_ENDPOINT, {
  timeout: 30000,
  clientConfig: {
    keepalive: true,
    keepaliveInterval: 60000,
  },
  reconnect: {
    auto: true,
  },
});

provider.on("connect", () => console.log("provider connected"));
provider.on("reconnect", () => console.log("provider reconnected"));
provider.on("close", () => console.log("provider close"));
provider.on("error", () => console.log("provider error"));

const web3 = new Web3(provider);

const instance = new web3.eth.Contract(sappySeals.abi, sappySeals.address);

async function init() {
  // init the watermark
  getWatermark();

  console.log("subscribing to transfers to the staking contract");
  instance.events.Transfer(
    {
      filter: {
        to: stakingContractAddress,
      },
    },
    (errors, event) => {
      if (errors) {
        console.error(errors);
        return;
      }

      console.log("received stake event:\n", event);
      checkDelta();
    }
  );

  console.log("subscribing to transfers from the staking contract");
  instance.events.Transfer(
    {
      filter: {
        from: stakingContractAddress,
      },
    },
    (errors, event) => {
      if (errors) {
        console.error(errors);
        return;
      }

      console.log("received unstake event:\n", event);
      checkDelta();
    }
  );
}

async function checkDelta() {
  console.log("checking delta");

  const stakedSeals = await getStakedSealsBalance();
  const watermark = await getWatermark();

  console.log("watermark:", watermark, getPercent(watermark));
  console.log("staked:", stakedSeals, getPercent(stakedSeals));
  console.log(
    "distance to threshold:",
    threshold - Math.abs(stakedSeals - watermark)
  );

  return handleDelta({ threshold, watermark, stakedSeals });
}

type HandleDeltaOptions = {
  threshold: number;
  watermark: number;
  stakedSeals: number;
};

async function handleDelta({
  threshold,
  watermark,
  stakedSeals,
}: HandleDeltaOptions) {
  if (stakedSeals >= watermark + threshold) {
    console.log("staked seals rose above watermark threshold");
    tweet(`ARF.. I mean staked Seals rose to ${getPercent(stakedSeals)}%`);
    setWatermark(stakedSeals);
  } else if (stakedSeals <= watermark - threshold) {
    console.log("staked seals fell below watermark threshold");
    tweet(`ARF.. I mean staked Seals fell to ${getPercent(stakedSeals)}%`);
    setWatermark(stakedSeals);
  } else {
    console.log("staked seals within watermark threshold");
  }
}

async function getStakedSealsBalance(): Promise<number> {
  const staked = await instance.methods.balanceOf(stakeSeals.address).call();
  return Number(staked);
}

function getPercent(seals: number): string {
  return (Math.round((4 * 100 * seals) / totalSeals) / 4).toFixed(2);
}

let watermark = null;

async function getWatermark(): Promise<number> {
  if (watermark == null) {
    try {
      const dbWatermark = await readWatermark();
      setWatermark(dbWatermark);
    } catch (e) {
      setWatermark(await getStakedSealsBalance());
    }
  }

  return watermark;
}

function setWatermark(val: number) {
  watermark = val;
  console.log("set watermark:", watermark, getPercent(watermark));
  void writeWatermark(watermark);
}

init().catch(() => {
  process.exit(1);
});
