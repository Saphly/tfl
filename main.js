import dotenv from "dotenv";
import fetch from "node-fetch";
import PromptSync from "prompt-sync";
// https://api.tfl.gov.uk/StopPoint/Search?query={query}[&modes][&faresOnly][&maxResults][&lines][&includeHubs][&tflOperatedNationalRailStationsOnly]
// https://api.tfl.gov.uk/Line/{ids}/Arrivals/{stopPointId}[?direction][&destinationStationId]

dotenv.config();
const defaultStation = process.env.DEF_STATION;
const defaultMode = process.env.DEF_MODE;
const defaultLine = process.env.DEF_LINE;

const getStopsInfo = async (params) => {
  try {
    const response = await fetch(
      `https://api.tfl.gov.uk/StopPoint/Search?${params}`,
      {
        headers: {
          api_key: process.env.API_KEY,
        },
      }
    );

    const respJson = await response.json();

    if (respJson.httpStatusCode || respJson.matches.length < 1) {
      console.log(respJson.message ?? "No matches found");
      return "";
    } else {
      return respJson.matches;
    }
  } catch (error) {
    console.log("Error in getting stop id: ", error);
  }
};

const getArrivalsPredictions = async (ids, stopPointId, params) => {
  try {
    const response = await fetch(
      `https://api.tfl.gov.uk/Line/${ids}/Arrivals/${stopPointId}?${params}`,
      {
        headers: {
          api_key: process.env.API_KEY,
        },
      }
    );

    const respJson = await response.json();

    if (respJson.httpStatusCode) {
      console.log(respJson.message);
      return;
    } else {
      return respJson;
    }
  } catch (error) {
    console.log("Error in getting arrival predictions: ", error);
  }
};

const formatAndPrintArrivals = (arrivals) => {
  let platformName = "";
  arrivals.sort((a, b) => {
    if (a.platformName.localeCompare(b.platformName) < 0) {
      return -1;
    } else if (a.platformName.localeCompare(b.platformName) > 0) {
      return 1;
    }

    if (a.timeToStation < b.timeToStation) {
      return -1;
    } else if (a.timeToStation > b.timeToStation) {
      return 1;
    }

    return 0;
  });

  for (const train of arrivals) {
    if (train.platformName !== platformName) {
      console.log(`\n${train.platformName}`);
      platformName = train.platformName;
    }
    console.log(
      train.towards.padEnd(30, " "),
      Math.floor(train.timeToStation / 60)
        .toString()
        .padEnd(6, " "),
      new Date(train.expectedArrival).toLocaleTimeString()
    );
  }
};

const transformToArrayForAutocomplete = (info, target) => {
  let ret = [];
  for (const element of info) {
    ret.push(element[target]);
  }
  return ret;
};

const complete = (commands) => {
  return (str) => {
    let i;
    let ret = [];
    for (i = 0; i < commands.length; i++) {
      if (commands[i].indexOf(str) == 0) ret.push(commands[i]);
    }
    return ret;
  };
};

const prompt = PromptSync();
let stationInput = prompt("Which underground station? ", defaultStation);

let getStopIdParams = new URLSearchParams({
  query: stationInput,
  modes: defaultMode,
});
let stopInfo = await getStopsInfo(getStopIdParams);

if (stopInfo.length < 1) {
  process.exit();
} else if (Array.isArray(stopInfo) && stopInfo.length > 1) {
  const promptAutocomplete = transformToArrayForAutocomplete(stopInfo, "name");
  console.log(promptAutocomplete.join("\n"));
  stationInput = prompt("Please specify: ", defaultStation, {
    autocomplete: complete(promptAutocomplete),
  });
  getStopIdParams = new URLSearchParams({
    query: stationInput,
    modes: defaultMode,
  });
  stopInfo = await getStopsInfo(getStopIdParams);
}

const stopId = stopInfo[0].id;

const directionInput = prompt("[Optional] Outbound / Inbound? ", "all");
const getArrivalsParams = new URLSearchParams({
  direction: directionInput,
});

const allArrivals = await getArrivalsPredictions(
  defaultLine,
  stopId,
  getArrivalsParams
);

console.log("".padEnd(60, "-"));
console.log(stopInfo[0].name, stopInfo[0].id);
console.log("Default line: Central");

formatAndPrintArrivals(allArrivals);
console.log("".padEnd(50, "-"));
