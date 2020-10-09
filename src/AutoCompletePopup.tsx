import * as CodeMirror from "codemirror";
import * as _ from "lodash";
import { HintResult, HintFunc, HintOptions, ExtendedCodeMirror, Completion, HintInfo } from "./models/ExtendedCodeMirror";
import grammarUtils from "./GrammarUtils";
import * as ReactDOM from 'react-dom';
import * as React from 'react';

export default class AutoCompletePopup {
    doc: CodeMirror.Doc;
    hintOptions: HintOptions;
    completionShow = false;
    appendSpace = true;
    customRenderCompletionItem: (self: HintResult, data: Completion, registerAndGetPickFunc: () => PickFunc) => React.ReactElement<any>;
    pick: (cm: ExtendedCodeMirror, self: HintResult, data: Completion) => string;
    operators: Array<any>;
    constructor(private cm: ExtendedCodeMirror, private container: any, private needAutoCompletevalues: (text: string) => HintInfo[]) {
        this.doc = cm.getDoc();
        this.container = container;
        cm.on("endCompletion", () => {
            this.completionShow = false;
        })

        this.hintOptions = this.createHintOption();

    }

    private processText(value: string | Object, insertQuota = false): any | Object {
        const isOperator = this.operators.includes(value);
        if (!_.isString(value)) {
            return value;
        }
        if (/\s/g.test(value) || insertQuota) {
            value = `"${value}"`;
        }
        if (grammarUtils.needSpaceAfter(value as string)) {
            if (isOperator) {
                return `${value} ""`;
            } else {
                return value + " ";
            }
        }
        return value;
    }

    private onPick(cm: ExtendedCodeMirror, self: HintResult, data: Completion) {
        var value = data.value;
        if (this.pick) {
            value = this.pick(cm, self, data);
        }

        if (typeof value !== "string") {
            return;
        }
        var doc = cm.getDoc();
        var content = doc.getRange(self.from, self.to);
        var newValue = this.processText(value, content.includes('"'));
        cm.replaceRange(newValue, self.from, self.to, "complete");
    }

    private renderHintElement(element: any, self: HintResult, data: Completion) {
        var div = document.createElement("div");
        var className = ` hint-value cm-${data.type}`;
        var registerAndGetPickFunc = () => {

            //hack with show-hint code mirror https://github.com/codemirror/CodeMirror/blob/master/addon/hint/show-hint.js
            // to prevent handling click event
            element.className += " custom";
            setTimeout(() => {

                element.hintId = null
            }, 0);

            return this.manualPick.bind(this, self, data);
        }

        if (this.customRenderCompletionItem) {
            ReactDOM.render(this.customRenderCompletionItem(self, data, registerAndGetPickFunc), div);
        } else {
            ReactDOM.render(<div className={className}>{data.value}</div>, div);
        }

        element.appendChild(div);
    }

    private manualPick(self: HintResult, data: Completion, value: string) {
        var completionControl = this.cm.state.completionActive;
        if (completionControl == null) return;

        var index = self.list.indexOf(data);
        data.hint = (cm: ExtendedCodeMirror, self: HintResult, data: Completion) => {
            var doc = cm.getDoc();
            var content = doc.getRange(self.from, self.to);
            var newValue = this.processText(value, content.includes('"'));
            cm.replaceRange(newValue, self.from, self.to, "complete");

        }
        completionControl.pick(self, index);

    }

    private buildComletionObj(info: HintInfo): Completion {
        return {
            value: info.value,
            type: info.type,
            hint: this.onPick.bind(this),
            render: this.renderHintElement.bind(this)
        };
    }

    private cursorInQuotaSection() {
        var doc = this.cm.getDoc();
        var currentCursor = doc.getCursor();
        var lineNumber = doc.lineCount();
        var content = doc.getValue();
        var beforeText = doc.getRange({ line: 0, ch: 0 }, currentCursor);
        var afterText = doc.getRange(currentCursor, { line: lineNumber, ch: content.length });
        var oddQuotaBefore = beforeText.split('').filter((s) => s == '"').length % 2 == 1;
        var oddQuotaAfter = afterText.split('').filter((s) => s == '"').length % 2 == 1;
        if (oddQuotaBefore && oddQuotaAfter) {
            var begin = _.findLastIndex(beforeText, f => f == '"');
            var end = _.findIndex(afterText, f => f == '"');
            return {
                lastSeparatorPos: {
                    line: currentCursor.line,
                    ch: begin
                },
                nextSeparatorPos: {
                    line: currentCursor.line,
                    ch: currentCursor.ch + end + 1
                }
            }
        }
        return false;
    }

    private findLastSeparatorPositionWithEditor() {
        var doc = this.cm.getDoc();
        var currentCursor = doc.getCursor();
        var text = doc.getRange({ line: 0, ch: 0 }, currentCursor);
        var index = grammarUtils.findLastSeparatorIndex(text);
        return {
            line: currentCursor.line,
            ch: currentCursor.ch - (text.length - index) + 1
        }

    }
    private findNextSeparatorPositionWithEditor() {
        var doc = this.cm.getDoc();
        var currentCursor = doc.getCursor();
        var content = doc.getValue();
        var text = doc.getRange(currentCursor, { line: currentCursor.line, ch: content.length });
        var index = grammarUtils.findFirstSeparatorIndex(text);
        return {
            line: currentCursor.line,
            ch: currentCursor.ch + index + 1
        }
    }

    show() {
        var cursor = this.doc.getCursor();
        var text = this.doc.getRange({ line: 0, ch: 0 }, cursor);
        this.hintOptions.hintValues = this.needAutoCompletevalues(text);

        this.cm.showHint(this.hintOptions);
        this.completionShow = true;
    }


    private createHintOption() {
        var hintOptions = new HintOptions();

        hintOptions.hint = (() => {
            var { hintValues } = hintOptions;
            var doc = this.cm.getDoc();
            var cursor = doc.getCursor();
            var lastSeparatorPos = this.findLastSeparatorPositionWithEditor();
            var nextSeparatorPos = this.findNextSeparatorPositionWithEditor();
            var cursorInSection = this.cursorInQuotaSection();
            var text = doc.getRange(lastSeparatorPos, nextSeparatorPos);
            if (cursorInSection) {
                lastSeparatorPos = cursorInSection.lastSeparatorPos;
                nextSeparatorPos = cursorInSection.nextSeparatorPos;
                text = doc.getRange(lastSeparatorPos, nextSeparatorPos);
                text = text.substring(1, text.length - 1);
            }
            var values = hintValues;
            var type = hintValues && hintValues[0] && hintValues[0].type;
            if (!cursorInSection && text.includes('"')) {
                text = text.trim();
                text = text.substring(1, text.length - 1);
            }
            if (text) {
                values = _.filter(hintValues, f => {
                    var value = f.value as string;
                    return _.isString(f.value) ? _.includes(value.toLowerCase(), text.toLowerCase()) : true;
                })
            }
            if (text && values && type == 'value') {
                let fullyMatch = false;
                for (const value of values) {
                    if (value.value == text) {
                        fullyMatch = true;
                        break;
                    }
                }
                if (!fullyMatch) values.unshift({
                    value: text,
                    type: 'value'
                });
            }
            return {
                list: _.map(values, c => this.buildComletionObj(c)),
                from: lastSeparatorPos,
                to: nextSeparatorPos
            }
        }) as HintFunc;

        hintOptions.hint.supportsSelection = true;
        hintOptions.container = document.getElementById(this.container);
        return hintOptions;
    }
}

interface PickFunc {
    (): void;
}