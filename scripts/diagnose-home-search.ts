import { discoverAppointmentProviderOptions } from "../server/services/appointmentDiscovery.js";

const address = process.argv[2];
if (!address) {
  console.error('Usage: npx tsx scripts/diagnose-home-search.ts "search address"');
  process.exitCode = 1;
} else {
  const started = Date.now();
  const result = await discoverAppointmentProviderOptions({
    appointmentType: "home-service", serviceType: "plumber", detail: "plumber",
    location: { address }, language: "es", maxResults: 3,
  });
  console.log(JSON.stringify({
    elapsedMs: Date.now() - started,
    outcome: result.fallback_reason ?? "providers_found",
    providers: result.options.map(option => ({
      name: option.provider_snapshot.name,
      address: option.provider_snapshot.address,
    })),
  }, null, 2));
}
