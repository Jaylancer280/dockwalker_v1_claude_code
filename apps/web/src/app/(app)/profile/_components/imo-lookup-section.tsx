'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';

export interface ImoSearchResult {
  id: string;
  name: string;
  vessel_type: string;
  loa_meters: number;
  imo_number: string;
}

export interface ImoLookupSectionProps {
  imoNumber: string;
  setImoNumber: (v: string) => void;
  useExisting: boolean;
  setUseExisting: (v: boolean) => void;
  existingVesselId: string;
  setExistingVesselId: (v: string) => void;
  vesselName: string;
  setVesselName: (v: string) => void;
  vesselType: 'motor' | 'sail';
  setVesselType: (v: 'motor' | 'sail') => void;
  loaMeters: string;
  setLoaMeters: (v: string) => void;
}

export function ImoLookupSection({
  imoNumber,
  setImoNumber,
  useExisting,
  setUseExisting,
  setExistingVesselId,
  vesselName,
  setVesselName,
  vesselType,
  setVesselType,
  loaMeters,
  setLoaMeters,
}: ImoLookupSectionProps) {
  const [lookingUpImo, setLookingUpImo] = useState(false);
  const [imoMessage, setImoMessage] = useState('');
  const [imoSearchResults, setImoSearchResults] = useState<ImoSearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-search when IMO has 4+ digits
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Only auto-search for partial (4-6 digits); 7 digits uses manual or exact lookup
    if (imoNumber.length >= 4 && imoNumber.length < 7 && !useExisting) {
      debounceRef.current = setTimeout(() => {
        async function fetchPartial() {
          try {
            setLookingUpImo(true);
            const result = await safeFetch<{ results: ImoSearchResult[] }>(
              `/api/vessels/lookup?imo=${imoNumber}`,
            );
            if (result.ok) {
              setImoSearchResults(result.data.results);
              if (result.data.results.length === 0) {
                setImoMessage('No vessels found for this prefix');
              } else {
                setImoMessage('');
              }
            }
          } finally {
            setLookingUpImo(false);
          }
        }
        fetchPartial();
      }, 500);
    } else {
      setImoSearchResults([]);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [imoNumber, useExisting]);

  function handleSelectSearchResult(result: ImoSearchResult) {
    setImoNumber(result.imo_number);
    setVesselName(result.name);
    setLoaMeters(String(result.loa_meters));
    setVesselType(result.vessel_type as 'motor' | 'sail');
    setExistingVesselId(result.id);
    setUseExisting(true);
    setImoSearchResults([]);
    setImoMessage('');
  }

  async function handleImoLookup() {
    if (imoNumber.length < 4) return;
    setLookingUpImo(true);
    setImoMessage('');
    setImoSearchResults([]);

    if (imoNumber.length === 7) {
      // Exact lookup
      const result = await safeFetch<{
        found: boolean;
        vessel?: { name: string; loa_meters: number; vessel_type: string; id: string };
      }>(`/api/vessels/lookup?imo=${imoNumber}`);
      if (result.ok) {
        if (result.data.found && result.data.vessel) {
          const prefix = result.data.vessel.vessel_type === 'sail' ? 'S/Y' : 'M/Y';
          setImoMessage(
            `Found: ${prefix} ${result.data.vessel.name} (${result.data.vessel.loa_meters}m)`,
          );
          setVesselName(result.data.vessel.name);
          setLoaMeters(String(result.data.vessel.loa_meters));
          setVesselType(result.data.vessel.vessel_type as 'motor' | 'sail');
          setExistingVesselId(result.data.vessel.id);
          setUseExisting(true);
        } else {
          setImoMessage('Not found — enter vessel details below');
          setUseExisting(false);
          setExistingVesselId('');
        }
      }
    } else {
      // Partial lookup (4-6 digits)
      const result = await safeFetch<{ results: ImoSearchResult[] }>(
        `/api/vessels/lookup?imo=${imoNumber}`,
      );
      if (result.ok) {
        setImoSearchResults(result.data.results);
        if (result.data.results.length === 0) {
          setImoMessage('No vessels found for this prefix');
        }
      }
    }
    setLookingUpImo(false);
  }

  return (
    <>
      {/* IMO lookup */}
      <div className="relative flex flex-col gap-1.5">
        <Label>IMO number</Label>
        <div className="flex gap-2">
          <Input
            placeholder="4-7 digits"
            value={imoNumber}
            onChange={(e) => {
              setImoNumber(e.target.value.replace(/\D/g, '').slice(0, 7));
              setUseExisting(false);
              setExistingVesselId('');
              setImoMessage('');
            }}
            maxLength={7}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={imoNumber.length < 4 || lookingUpImo}
            onClick={handleImoLookup}
          >
            {lookingUpImo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        {imoMessage && !useExisting && (
          <p className="text-xs text-muted-foreground">{imoMessage}</p>
        )}
        {/* Partial search results dropdown */}
        {imoSearchResults.length > 0 && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
            {imoSearchResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => handleSelectSearchResult(result)}
              >
                <span className="font-medium">
                  {result.vessel_type === 'sail' ? 'S/Y' : 'M/Y'} {result.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  IMO {result.imo_number} · {result.loa_meters}m
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Found vessel card */}
      {useExisting && (
        <div className="rounded-lg border border-success/40 bg-success/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {vesselType === 'sail' ? 'S/Y' : 'M/Y'} {vesselName}
              </p>
              <p className="text-xs text-muted-foreground">
                {loaMeters}m · IMO {imoNumber}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setUseExisting(false);
                setExistingVesselId('');
                setImoMessage('Enter vessel details below');
              }}
            >
              Enter manually
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
