const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB server Error : ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//Convert Response to CamelCase From snake_case;
const convertAllCamelCaseFromSnakeCase = (responseObject) => {
  return {
    stateId: responseObject.state_id,
    stateName: responseObject.state_name,
    population: responseObject.population,
    districtId: responseObject.district_id,
    districtName: responseObject.district_name,
    cases: responseObject.cases,
    cured: responseObject.cured,
    active: responseObject.active,
    deaths: responseObject.deaths,
  };
};

//API 1 -- login/post
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication Code -- Token Authentication
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwt === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API2 -- states/get method
app.get("/states/", authenticationToken, async (request, response) => {
  const getStateDetailsQuery = `SELECT * FROM state;`;
  const allStateDetails = await db.all(getStateDetailsQuery);
  response.send(
    allStateDetails.map((eachStateDetail) =>
      convertAllCamelCaseFromSnakeCase(eachStateDetail)
    )
  );
});

//API 3 -- state get by StateID
app.get("/states/:stateId", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const stateDetails = await db.get(getStateDetailsQuery);
  response.send(convertAllCamelCaseFromSnakeCase(stateDetails));
});

//API 4 Create a district in the district table -- post
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  const newDistrict = await db.run(addDistrict);
  response.send("District Successfully Added");
});

//API 5 Returns a district based on the district ID
app.get(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(convertAllCamelCaseFromSnakeCase(districtDetails));
  }
);

//API 6 Delete District according to district Id;
app.delete(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id = '${districtId}';`;
    const deleteDistrict = await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const districtId = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrict = `UPDATE district SET
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}';`;
    const updateDistrictDetails = await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getData = `
    SELECT 
    sum(cases) AS totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM district 
    WHERE state_id = ${stateId};`;
    const data = await db.get(getData);
    response.send(data);
  }
);

module.exports = app;
