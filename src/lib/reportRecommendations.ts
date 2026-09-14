export function uniqueReportLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, list) => list.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index);
}

function isDoctorContactRecommendation(line: string) {
  return /\b(contacta|contact|habla|talk|speak|llama|call|share|comparte|book|reserve|reserva)\b.*\b(doctor|m[eé]dico|medico|clinician|clinic|cl[ií]nica|clinica|urgent care|urgencias|medical advice|consejo medico)\b/i.test(line);
}

export function compactReportRecommendations(lines: string[], options: { max?: number; level?: string } = {}) {
  const compacted: string[] = [];
  let keptDoctorContact = false;

  for (const line of uniqueReportLines(lines)) {
    const doctorContact = isDoctorContactRecommendation(line);
    if (doctorContact) {
      if (keptDoctorContact) continue;
      keptDoctorContact = true;
    }

    compacted.push(line);
  }

  return compacted.slice(0, options.max ?? 4);
}
