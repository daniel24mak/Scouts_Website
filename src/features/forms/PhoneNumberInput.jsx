import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode
} from "libphonenumber-js";
import {
  formatPhoneAnswer,
  getCountryName,
  normalizePhoneAnswer,
  normalizePhoneSettings,
  validatePhoneAnswer
} from "./formModel.js";

function countryFlag(country) {
  return country
    .toUpperCase()
    .replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt()));
}

export default function PhoneNumberInput({
  question,
  value,
  onChange,
  disabled = false,
  showError = false
}) {
  const id = useId();
  const menuRef = useRef(null);
  const settings = normalizePhoneSettings(question.phoneSettings);
  const normalized = normalizePhoneAnswer(value, settings.defaultCountry);
  const selectedCountry = settings.countryMode === "single"
    ? settings.allowedCountry
    : normalized.country || settings.defaultCountry;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const countries = useMemo(() => getCountries()
    .map((country) => ({
      country,
      name: getCountryName(country),
      callingCode: `+${getCountryCallingCode(country)}`
    }))
    .filter((item) => `${item.name} ${item.country} ${item.callingCode}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())), [query]);
  const error = validatePhoneAnswer(question, value);
  const nationalValue = value
    ? new AsYouType(selectedCountry).input(normalized.nationalNumber)
    : "";

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [isOpen]);

  if (disabled) {
    return (
      <div className="forms-phone-readonly">
        <span>{countryFlag(normalized.country)}</span>
        <strong>{formatPhoneAnswer(value) || "Not answered"}</strong>
      </div>
    );
  }

  const updateNumber = (nextValue, country = selectedCountry) => {
    const digits = nextValue.replace(/\D/g, "");
    onChange(normalizePhoneAnswer({ country, nationalNumber: digits }, country));
  };

  return (
    <div className={`forms-phone-field ${showError && error ? "has-error" : ""}`}>
      <div className="forms-phone-control">
        {settings.countryMode === "all" ? (
          <div className="forms-country-picker" ref={menuRef}>
            <button
              type="button"
              className="forms-country-trigger"
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              aria-controls={`${id}-countries`}
              onClick={() => setIsOpen((current) => !current)}
            >
              <span aria-hidden="true">{countryFlag(selectedCountry)}</span>
              <span>+{getCountryCallingCode(selectedCountry)}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="forms-country-menu" id={`${id}-countries`}>
                <label className="forms-country-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">Search countries</span>
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search country or code"
                  />
                </label>
                <div role="listbox" aria-label="Country calling code">
                  {countries.map((item) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.country === selectedCountry}
                      key={item.country}
                      onClick={() => {
                        updateNumber(normalized.nationalNumber, item.country);
                        setQuery("");
                        setIsOpen(false);
                      }}
                    >
                      <span aria-hidden="true">{countryFlag(item.country)}</span>
                      <span>{item.name}</span>
                      <small>{item.callingCode}</small>
                      {item.country === selectedCountry && <Check size={16} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="forms-country-fixed" title={getCountryName(selectedCountry)}>
            <span aria-hidden="true">{countryFlag(selectedCountry)}</span>
            <span>+{getCountryCallingCode(selectedCountry)}</span>
          </div>
        )}
        <input
          id={`${id}-number`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={nationalValue}
          onChange={(event) => updateNumber(event.target.value)}
          placeholder="Phone number"
          aria-label={question.text || "Phone number"}
          aria-invalid={showError && Boolean(error)}
          aria-describedby={showError && error ? `${id}-error` : undefined}
        />
      </div>
      {showError && error && <small id={`${id}-error`} className="forms-field-error">{error}</small>}
    </div>
  );
}
