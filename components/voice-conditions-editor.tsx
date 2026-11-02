"use client";

import {useId, type Dispatch, type SetStateAction} from 'react';
import {ResourceHint} from './resource-hint';
import {SelectField} from './select-field';
import {Input} from './ui/input';
import {Checkbox} from './ui/checkbox';
import {conditionFeatures, conditionCapabilities, newCondition} from '../lib/configuration-schema';
import type {Resource, DetectionCondition} from '../lib/workflow';

type NumberKey = 'count' | 'windowSeconds' | 'stageSeconds' | 'middleStartSeconds' | 'middleEndSeconds';

function ConditionNumber({condition, field, label, suffix, min, max, disabled, onChange}: {
  condition: DetectionCondition; field: NumberKey; label: string; suffix: string;
  min: number; max: number; disabled: boolean; onChange: (value: number) => void;
}) {
  const id = useId();
  const value = condition[field];
  const empty = value === undefined || !Number.isFinite(value);
  const error = disabled ? '' : empty ? '请填写数值' : !Number.isInteger(value) || value! < min || value! > max ? `请输入 ${min}–${max} 的整数` : '';
  return <div className="voice-number-field">
    <label htmlFor={id}>{label}</label>
    <Input id={id} name={`${condition.feature}-${field}`} type="number" inputMode="numeric" required min={min} max={max} step={1}
      disabled={disabled} value={empty ? '' : value} aria-label={`${condition.feature} ${label}`} aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined} onChange={event=>onChange(event.target.value === '' ? NaN : event.target.valueAsNumber)}/>
    <span>{suffix}</span>
    {field === 'windowSeconds' && <span inert={disabled}><ResourceHint label={`${condition.feature}统计窗口说明`}>填 0 时统计整通通话；其他值为指定秒数内的累计次数。</ResourceHint></span>}
    {error && <p id={`${id}-error`} className="form-error" role="alert">{error}</p>}
  </div>;
}

export function VoiceConditionsEditor({resource, conditions, setConditions, disabled, attempted}: {
  resource: Resource; conditions: DetectionCondition[]; setConditions: Dispatch<SetStateAction<DetectionCondition[]>>;
  disabled: boolean; attempted: boolean;
}) {
  const id = useId();
  const features = conditionFeatures(resource);
  const options = [...new Set([...features, ...conditions.map(condition=>condition.feature)])];
  const empty = attempted && !conditions.some(condition=>condition.enabled !== false);
  const update = (feature: string, patch: Partial<DetectionCondition>) => setConditions(rows=>rows.some(row=>row.feature === feature)
    ? rows.map(row=>row.feature === feature ? {...row, ...patch} : row)
    : [...rows, {...newCondition(feature), ...patch}]);

  return <section className="voice-conditions" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className="policy-title-with-info">检测条件<ResourceHint label="检测条件说明">选择需要检测的异常；每项独立配置阶段与触发方式，满足任一已选条件后执行对应预警策略。</ResourceHint></h3>
    <p className="voice-conditions-description">满足任一已选条件后，执行对应预警策略。</p>
    {empty && <p id={`${id}-error`} role="alert" className="form-error">请至少选择一项检测条件</p>}
    <table className="voice-conditions-table" aria-label="声纹检测条件配置">
      <colgroup><col/><col/><col/></colgroup>
      <thead><tr><th scope="col">检测条件</th><th scope="col">检测阶段</th><th scope="col">触发方式</th></tr></thead>
      <tbody>{options.map(feature=>{
        const stored = conditions.find(condition=>condition.feature === feature);
        const condition = stored ? {...newCondition(feature), ...stored} : {...newCondition(feature), enabled: false};
        const checked = condition.enabled !== false;
        const locked = disabled || !checked;
        const capabilities = conditionCapabilities(resource.kind, feature);
        const number = (field: NumberKey, label: string, suffix: string, min: number, max = 3600) => <ConditionNumber
          condition={condition} field={field} label={label} suffix={suffix} min={min} max={max} disabled={locked}
          onChange={value=>update(feature, {[field]: value})}/>;
        return <tr key={feature} data-enabled={checked}>
          <th scope="row"><label className="voice-condition-choice"><Checkbox checked={checked} disabled={disabled}
            aria-describedby={empty ? `${id}-error` : undefined} aria-invalid={empty}
            onCheckedChange={value=>update(feature, {enabled: value === true})}/>{feature}</label>
            {!features.includes(feature) && <p className="form-error">资源中已移除，请取消触发</p>}
          </th>
          <td><div className="voice-condition-cell">
            <SelectField aria-label={`${feature} 检测阶段`} value={condition.stage} disabled={locked} onValueChange={stage=>update(feature, {stage})}>
              {capabilities.stages.map(stage=><option key={stage}>{stage}</option>)}
            </SelectField>
            {condition.stage === '开场' && number('stageSeconds', '开始后', '秒内', 1)}
            {condition.stage === '结束' && number('stageSeconds', '结束前', '秒内', 1)}
            {condition.stage === '服务中' && <div className="voice-detail-row">
              {number('middleStartSeconds', '开始', '秒后', 0)}
              {number('middleEndSeconds', '结束前', '秒截止', 0)}
            </div>}
          </div></td>
          <td><div className="voice-condition-cell">
            <SelectField aria-label={`${feature} 触发方式`} value={condition.mode} disabled={locked} onValueChange={mode=>update(feature, {mode})}>
              {capabilities.modes.map(mode=><option key={mode}>{mode}</option>)}
            </SelectField>
            {condition.mode === '累计次数' && <div className="voice-detail-row">
              {number('count', '累计', '次', 1, 1000)}
              {number('windowSeconds', '统计窗口', '秒', 0)}
            </div>}
          </div></td>
        </tr>;
      })}</tbody>
    </table>
  </section>;
}
