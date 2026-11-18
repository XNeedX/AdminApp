/**
 * Single option rendered by `AutocompleteComponent`.
 *
 * The shape is intentionally generic so any catalog (specializations, offices, …)
 * can be adapted to it. Feature models may re-export this type instead of
 * declaring a structurally identical one.
 */
export interface AutocompleteOption {
  readonly id: string;
  readonly label: string;
}
