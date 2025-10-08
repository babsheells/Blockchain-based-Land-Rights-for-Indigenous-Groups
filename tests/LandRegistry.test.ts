import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_UNAUTHORIZED = 100;
const ERR_DUPLICATE_PARCEL = 101;
const ERR_NOT_FOUND = 102;
const ERR_INVALID_HASH = 103;
const ERR_INVALID_BOUNDARIES = 104;
const ERR_INVALID_COMMUNITY_ID = 105;
const ERR_INVALID_DESCRIPTION = 106;
const ERR_INVALID_OWNERSHIP_TYPE = 109;
const ERR_INVALID_AREA = 110;
const ERR_INVALID_LOCATION = 111;
const ERR_INVALID_DOCS_HASH = 117;
const ERR_INVALID_COORDINATES = 118;
const ERR_INVALID_ZONE = 119;
const ERR_INVALID_ACCESS_LEVEL = 120;
const ERR_MAX_PARCELS_EXCEEDED = 113;
const ERR_INVALID_UPDATE_PARAM = 114;
const ERR_AUTHORITY_NOT_VERIFIED = 108;

interface Parcel {
  geoHash: Uint8Array;
  boundaries: string;
  communityId: number;
  description: string;
  timestamp: number;
  registrant: string;
  ownershipType: string;
  area: number;
  location: string;
  status: boolean;
  docsHash: Uint8Array;
  coordinates: string;
  zone: string;
  accessLevel: number;
}

interface ParcelUpdate {
  updateBoundaries: string;
  updateDescription: string;
  updateTimestamp: number;
  updater: string;
  updateArea: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class LandRegistryMock {
  state: {
    nextParcelId: number;
    maxParcels: number;
    registrationFee: number;
    authorityContract: string | null;
    landParcels: Map<number, Parcel>;
    parcelUpdates: Map<number, ParcelUpdate>;
    parcelsByHash: Map<string, number>;
  } = {
    nextParcelId: 0,
    maxParcels: 5000,
    registrationFee: 500,
    authorityContract: null,
    landParcels: new Map(),
    parcelUpdates: new Map(),
    parcelsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextParcelId: 0,
      maxParcels: 5000,
      registrationFee: 500,
      authorityContract: null,
      landParcels: new Map(),
      parcelUpdates: new Map(),
      parcelsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  registerParcel(
    geoHash: Uint8Array,
    boundaries: string,
    communityId: number,
    description: string,
    ownershipType: string,
    area: number,
    location: string,
    docsHash: Uint8Array,
    coordinates: string,
    zone: string,
    accessLevel: number
  ): Result<number> {
    if (this.state.nextParcelId >= this.state.maxParcels) return { ok: false, value: ERR_MAX_PARCELS_EXCEEDED };
    if (geoHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!boundaries || boundaries.length > 500) return { ok: false, value: ERR_INVALID_BOUNDARIES };
    if (communityId <= 0) return { ok: false, value: ERR_INVALID_COMMUNITY_ID };
    if (description.length > 1000) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (!["communal", "individual", "tribal"].includes(ownershipType)) return { ok: false, value: ERR_INVALID_OWNERSHIP_TYPE };
    if (area <= 0) return { ok: false, value: ERR_INVALID_AREA };
    if (!location || location.length > 200) return { ok: false, value: ERR_INVALID_LOCATION };
    if (docsHash.length !== 32) return { ok: false, value: ERR_INVALID_DOCS_HASH };
    if (!coordinates || coordinates.length > 500) return { ok: false, value: ERR_INVALID_COORDINATES };
    if (zone.length > 100) return { ok: false, value: ERR_INVALID_ZONE };
    if (accessLevel > 3) return { ok: false, value: ERR_INVALID_ACCESS_LEVEL };
    const hashKey = geoHash.toString();
    if (this.state.parcelsByHash.has(hashKey)) return { ok: false, value: ERR_DUPLICATE_PARCEL };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextParcelId;
    const parcel: Parcel = {
      geoHash,
      boundaries,
      communityId,
      description,
      timestamp: this.blockHeight,
      registrant: this.caller,
      ownershipType,
      area,
      location,
      status: true,
      docsHash,
      coordinates,
      zone,
      accessLevel,
    };
    this.state.landParcels.set(id, parcel);
    this.state.parcelsByHash.set(hashKey, id);
    this.state.nextParcelId++;
    return { ok: true, value: id };
  }

  getParcel(id: number): Parcel | null {
    return this.state.landParcels.get(id) || null;
  }

  updateParcel(id: number, updateBoundaries: string, updateDescription: string, updateArea: number): Result<boolean> {
    const parcel = this.state.landParcels.get(id);
    if (!parcel) return { ok: false, value: false };
    if (parcel.registrant !== this.caller) return { ok: false, value: false };
    if (!updateBoundaries || updateBoundaries.length > 500) return { ok: false, value: false };
    if (updateDescription.length > 1000) return { ok: false, value: false };
    if (updateArea <= 0) return { ok: false, value: false };

    const updated: Parcel = {
      ...parcel,
      boundaries: updateBoundaries,
      description: updateDescription,
      timestamp: this.blockHeight,
      area: updateArea,
    };
    this.state.landParcels.set(id, updated);
    this.state.parcelUpdates.set(id, {
      updateBoundaries,
      updateDescription,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateArea,
    });
    return { ok: true, value: true };
  }

  getParcelCount(): Result<number> {
    return { ok: true, value: this.state.nextParcelId };
  }

  checkParcelExistence(geoHash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.parcelsByHash.has(geoHash.toString()) };
  }
}

describe("LandRegistry", () => {
  let contract: LandRegistryMock;

  beforeEach(() => {
    contract = new LandRegistryMock();
    contract.reset();
  });

  it("registers a parcel successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    const result = contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const parcel = contract.getParcel(0);
    expect(parcel?.boundaries).toBe("bounds");
    expect(parcel?.communityId).toBe(1);
    expect(parcel?.description).toBe("desc");
    expect(parcel?.ownershipType).toBe("communal");
    expect(parcel?.area).toBe(100);
    expect(parcel?.location).toBe("loc");
    expect(parcel?.coordinates).toBe("coords");
    expect(parcel?.zone).toBe("zone");
    expect(parcel?.accessLevel).toBe(1);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate parcel hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    const result = contract.registerParcel(
      geoHash,
      "newbounds",
      2,
      "newdesc",
      "individual",
      200,
      "newloc",
      docsHash,
      "newcoords",
      "newzone",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DUPLICATE_PARCEL);
  });

  it("parses parcel boundaries with Clarity", () => {
    const cv = stringUtf8CV("bounds");
    expect(cv.value).toBe("bounds");
  });

  it("rejects parcel registration without authority contract", () => {
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    const result = contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid geo hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(31).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    const result = contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid boundaries", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    const result = contract.registerParcel(
      geoHash,
      "",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BOUNDARIES);
  });

  it("rejects invalid ownership type", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    const result = contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "invalid",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_OWNERSHIP_TYPE);
  });

  it("updates a parcel successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash,
      "oldbounds",
      1,
      "olddesc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    const result = contract.updateParcel(0, "newbounds", "newdesc", 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const parcel = contract.getParcel(0);
    expect(parcel?.boundaries).toBe("newbounds");
    expect(parcel?.description).toBe("newdesc");
    expect(parcel?.area).toBe(200);
    const update = contract.state.parcelUpdates.get(0);
    expect(update?.updateBoundaries).toBe("newbounds");
    expect(update?.updateDescription).toBe("newdesc");
    expect(update?.updateArea).toBe(200);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent parcel", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateParcel(99, "newbounds", "newdesc", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-registrant", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateParcel(0, "newbounds", "newdesc", 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority contract", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct parcel count", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash1 = new Uint8Array(32).fill(1);
    const docsHash1 = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash1,
      "bounds1",
      1,
      "desc1",
      "communal",
      100,
      "loc1",
      docsHash1,
      "coords1",
      "zone1",
      1
    );
    const geoHash2 = new Uint8Array(32).fill(3);
    const docsHash2 = new Uint8Array(32).fill(4);
    contract.registerParcel(
      geoHash2,
      "bounds2",
      2,
      "desc2",
      "individual",
      200,
      "loc2",
      docsHash2,
      "coords2",
      "zone2",
      2
    );
    const result = contract.getParcelCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks parcel existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash,
      "bounds",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    const result = contract.checkParcelExistence(geoHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(5);
    const result2 = contract.checkParcelExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses parcel parameters with Clarity types", () => {
    const boundaries = stringUtf8CV("bounds");
    const communityId = uintCV(1);
    const area = uintCV(100);
    expect(boundaries.value).toBe("bounds");
    expect(communityId.value).toEqual(BigInt(1));
    expect(area.value).toEqual(BigInt(100));
  });

  it("rejects parcel registration with empty boundaries", () => {
    contract.setAuthorityContract("ST2TEST");
    const geoHash = new Uint8Array(32).fill(1);
    const docsHash = new Uint8Array(32).fill(2);
    const result = contract.registerParcel(
      geoHash,
      "",
      1,
      "desc",
      "communal",
      100,
      "loc",
      docsHash,
      "coords",
      "zone",
      1
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BOUNDARIES);
  });

  it("rejects parcel registration with max parcels exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxParcels = 1;
    const geoHash1 = new Uint8Array(32).fill(1);
    const docsHash1 = new Uint8Array(32).fill(2);
    contract.registerParcel(
      geoHash1,
      "bounds1",
      1,
      "desc1",
      "communal",
      100,
      "loc1",
      docsHash1,
      "coords1",
      "zone1",
      1
    );
    const geoHash2 = new Uint8Array(32).fill(3);
    const docsHash2 = new Uint8Array(32).fill(4);
    const result = contract.registerParcel(
      geoHash2,
      "bounds2",
      2,
      "desc2",
      "individual",
      200,
      "loc2",
      docsHash2,
      "coords2",
      "zone2",
      2
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PARCELS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});