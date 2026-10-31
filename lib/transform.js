// lib/transform.js

const API_VERSION = "v2.1";
const PORTAL_NAME = "Elite Vehicle Desk";
const NOT_FOUND_MSG = "Details Not Found";

const MONTHS = { ... };

function parseRegDate(str) { ... }
function computeAge(regDateStr, now = new Date()) {
  const regDate = parseRegDate(regDateStr);
  if (!regDate) return null;
  ...
  return { years, months, days, formatted };
}

function maskMobile(mobile, mode) {
  if (!mobile) return null;
  ...
}

function fmtTs(d) { ... }

export function isVehicleValid(upstream) {
  if (!upstream || upstream.success !== true) return false;
  const v = upstream.vehicle;
  if (!v || typeof v !== "object") return false;
  if (!v.chassis || String(v.chassis).trim() === "") return false;
  return true;
}

export function buildNotFoundResponse(elapsedMs) {
  return {
    success: false,
    status: "DETAILS_NOT_FOUND",
    message: NOT_FOUND_MSG,
    meta: {
      api_version: API_VERSION,
      portal: PORTAL_NAME,
      processed_in: (elapsedMs / 1000).toFixed(2) + "s",
      timestamp: fmtTs(new Date()),
    },
  };
}

export function buildSuccessResponse(upstream, elapsedMs, maskMode = "none") {
  const v = upstream.vehicle;
  const make = v.make ? String(v.make).trim() : "";
  const model = v.model ? String(v.model).trim() : "";
  const maker_model = [make, model].filter(Boolean).join(" ") || null;

  return {
    success: true,
    meta: {
      api_version: API_VERSION,
      portal: PORTAL_NAME,
      processed_in: (elapsedMs / 1000).toFixed(2) + "s",
      timestamp: upstream.timestamp || fmtTs(new Date()),
      data_source: v.source ?? null,
      upstream_runtime: upstream.runtime ?? null,
      source_credits: upstream.credits ?? null,
      source_developer: upstream.developer ?? null,
      source_key_expiry: upstream.key_expiry ?? null,
    },
    vehicle_summary: {
      registration_no: v.registration_no ?? upstream.reg_no ?? null,
      vehicle_class: v.vehicle_class ?? null,
      category: v.vehicle_category ?? null,
      maker_model,
      make: v.make ?? null,
      model: v.model ?? null,
      variant: v.variant ?? null,
      fuel_type: v.fuel ?? null,
      color: v.color ?? null,
      body_type: v.body_type ?? null,
      norms: v.norms ?? null,
    },
    owner_info: {
      owner_name: v.owner ?? null,
      father_name: v.father_name ?? null,
      financier: v.financier ?? null,
      mobile: upstream.mobile ?? null,
      masked_mobile: maskMobile(upstream.mobile, maskMode),
      mobile_found: typeof upstream.mobile_found === "boolean" ? upstream.mobile_found : null,
    },
    compliance_status: {
      insurance_company: v.insurance_company ?? null,
      insurance_policy_no: v.insurance_policy_no ?? null,
      insurance_upto: v.insurance_upto ?? null,
      puc_no: v.puc_no ?? null,
      puc_upto: v.puc_upto ?? null,
      tax_upto: v.tax_upto ?? null,
      fit_upto: v.fit_upto ?? null,
      status: v.status ?? null,
      status_as_on: v.status_as_on ?? null,
    },
    registration_details: {
      rto_office: v.rto ?? null,
      registration_date: v.registration_date ?? null,
      vehicle_age: computeAge(v.registration_date),
      city: v.city ?? null,
      address: v.address ?? null,
    },
    technical_data: {
      chassis_number: v.chassis ?? null,
      chassis_last5: upstream.chassis_last5 ?? null,
      engine_number: v.engine ?? null,
      cubic_capacity: v.cubic_capacity ?? null,
      seating_capacity: v.seating_capacity ?? null,
    },
  };
}

export function errorResponse(code, message, elapsedMs) { ... }
