import registeredScoutsSheet from "./sheets/registered-scouts.xls?raw";
import registrationData from "./generated/registration-settings.json";

export const registrationImportSettings = registrationData.registrationImportSettings;
export const groupingRulesStore = registrationData.groupingRulesStore;

function parseExcelSheet(sheetText) {
  return [...sheetText.matchAll(/<Row>(.*?)<\/Row>/gs)]
    .slice(1)
    .map((rowMatch) =>
      [...rowMatch[1].matchAll(/<Cell><Data[^>]*>(.*?)<\/Data><\/Cell>/gs)].map((cellMatch) =>
        cellMatch[1].trim()
      )
    );
}

export const registeredScouts = parseExcelSheet(registeredScoutsSheet).map((row) => {
  const [id, name, schoolGrade, age, school, groupId, parentName, parentPhone, status] = row;

  return {
    id: Number(id),
    name,
    schoolGrade,
    age: Number(age),
    school,
    groupId,
    parentName,
    parentPhone,
    status
  };
});
