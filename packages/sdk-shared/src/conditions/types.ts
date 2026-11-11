/**
 * A condition as Plitzi stores it — a flag's rules, an interaction's `when`, a binding's condition: the schema's own
 * format, so sdk-shared defines it (docs/en/server-packages.md, D13). plitzi-ui's QueryBuilder edits the same shape with prop types of its
 * own, and a type test in the builder, where the two meet, holds them assignable both ways.
 */

export type RuleValue = Date | string | number | boolean | undefined | null | object;

export type Combinator = 'and' | 'or';

export type Operator =
  | ''
  | '='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'contains'
  | 'doesNotContain'
  | 'beginsWith'
  | 'doesNotBeginWith'
  | 'endsWith'
  | 'doesNotEndWith'
  | 'empty'
  | 'notEmpty'
  | 'in'
  | 'notIn'
  | 'between'
  | 'notBetween';

export type RuleGroup = {
  id?: string;
  combinator: Combinator;
  rules: (Rule | RuleGroup)[];
  enabled?: boolean;
};

export type Rule = {
  id?: string;
  field: string;
  operator: Operator;
  enabled?: boolean;
} & ({ isBinding: true; value: string } | { isBinding?: false; value: RuleValue });

export type Field = {
  name: string;
  label: string;
  placeholder?: string;
  defaultOperator?: Operator;
  operators?: { value: Operator; label: string }[];
  group?: string;
  inputType?:
    'checkbox' | 'radio' | 'multiselect' | 'select' | 'text' | 'number' | 'date' | 'time' | 'datetime' | 'textarea';
  defaultValue?: RuleValue;
  validator?: (value?: string | number | boolean) => boolean | string;
  options?: { value: RuleValue; label: string }[];
};
