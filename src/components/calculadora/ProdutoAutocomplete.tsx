import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Produto } from "@/types/erp";

export interface ProdutoAutocompleteProps {
  produtos: Produto[];
  value: string | null;
  onChange: (produto: Produto | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}

/** Combobox com busca por código OU descrição (case-insensitive). */
export function ProdutoAutocomplete({
  produtos,
  value,
  onChange,
  placeholder = "Buscar por código ou descrição…",
  emptyLabel = "Nenhum produto encontrado",
  disabled,
}: ProdutoAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const selected = produtos.find((p) => p.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.codigo ? `[${selected.codigo}] ` : ""}${selected.nome}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            // value = id; usamos haystack abaixo via keywords
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {produtos.map((p) => {
                const haystack = [p.codigo, p.nome, p.descricao, p.fabricante, p.perfil, p.acabamento]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return (
                  <CommandItem
                    key={p.id}
                    value={haystack}
                    onSelect={() => {
                      onChange(p.id === value ? null : p);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === p.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm">
                        {p.codigo && (
                          <span className="font-mono text-xs text-muted-foreground">
                            [{p.codigo}]{" "}
                          </span>
                        )}
                        {p.nome}
                      </span>
                      {p.descricao && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {p.descricao}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
