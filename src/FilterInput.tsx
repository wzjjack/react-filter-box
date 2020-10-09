import * as React from 'react';
import * as _ from "lodash";
import * as CodeMirror from "codemirror";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/display/placeholder";
import "./FilterMode"
import 'codemirror/lib/codemirror.css';
import "codemirror/addon/hint/show-hint.css";
import { UnControlled as ReactCodeMirror, IInstance } from 'react-codemirror2'

import grammarUtils from "./GrammarUtils";
import { ExtendedCodeMirror } from "./models/ExtendedCodeMirror";
import AutoCompletePopup from "./AutoCompletePopup";
import GridDataAutoCompleteHandler from "./GridDataAutoCompleteHandler";

export default class FilterInput extends React.Component<any, any> {
    options: CodeMirror.EditorConfiguration;
    codeMirror: ExtendedCodeMirror;
    doc: CodeMirror.Doc;
    autoCompletePopup: AutoCompletePopup;
    submitTimer: any;
    public static defaultProps: any = {
        onBlur: () => { },
        onFocus: () => { },
        editorConfig: {}
    };

    constructor(props: any) {
        super(props);
        if (props.editorConfig) {
            this.options = { ...props.editorConfig, mode: "filter-mode" }
        }
    }


    findLastSeparatorPositionWithEditor() {
        var doc = this.codeMirror.getDoc();
        var currentCursor = doc.getCursor();
        var text = doc.getRange({ line: 0, ch: 0 }, currentCursor);
        var index = grammarUtils.findLastSeparatorIndex(text);
        return {
            line: currentCursor.line,
            ch: currentCursor.ch - (text.length - index) + 1
        }
    }


    private handlePressingAnyCharacter() {
        if (this.autoCompletePopup.completionShow) {
            return;
        }

        this.autoCompletePopup.show();
    }

    private onSubmit(text: string) {
        // if (this.submitTimer) clearTimeout(this.submitTimer);
        // this.submitTimer = setTimeout(() => {
        //     if (this.props.onSubmit) {
        //         this.props.onSubmit(text);
        //     }
        // }, 500)
        this.props.onSubmit(text);

    }

    private codeMirrorRef(ref: { editor: ExtendedCodeMirror }) {
        if (ref == null) return;
        if (this.codeMirror == ref.editor) {
            return;
        }

        this.codeMirror = ref.editor;
        this.doc = ref.editor.getDoc();
        this.autoCompletePopup = new AutoCompletePopup(this.codeMirror,this.props.autoPickContainer, (text) => {
            return this.props.needAutoCompleteValues(this.codeMirror, text);
        })

        this.autoCompletePopup.customRenderCompletionItem = this.props.customRenderCompletionItem;
        this.autoCompletePopup.pick = this.props.autoCompletePick;
        if (this.props.autoCompletePick) {
            this.autoCompletePopup.operators = this.props.autoCompletePick.needOperators(null);
        } else {
            this.autoCompletePopup.operators = new GridDataAutoCompleteHandler([], []).needOperators(null);
        }


        ref.editor.on("beforeChange", function (instance, change) {
            var newtext = change.text.join("").replace(/\n/g, ""); // remove ALL \n !
            change.update(change.from, change.to, [newtext] as any);
            return true;
        });

        ref.editor.on("changes", (instance, changes) => {
            var lastChange = changes[changes.length - 1] as any;
            var text = lastChange.text[0];
            if (text.substring(text.length - 2) == '""') {
                this.doc.setCursor({
                    line: lastChange.from.line,
                    ch: lastChange.from.ch + text.length - 1
                })
            }
            this.handlePressingAnyCharacter();
            // this.onSubmit(this.doc.getValue());
        })

        ref.editor.on("focus", (cm, e?) => {
            this.handlePressingAnyCharacter();
            this.props.onFocus(e);
        })

        ref.editor.on("blur", (cm, e?) => {
            setTimeout(() => {
                this.onSubmit(this.doc.getValue());
                this.props.onBlur(e);
            }, 300)
        })

        ref.editor.on("keyup", (cm: ExtendedCodeMirror, e?: KeyboardEvent) => {
            if (e.keyCode == 13 || e.keyCode == 32) {
                this.onSubmit(this.doc.getValue());
            }
        });
    }

    private handleEditorChange(_editor: IInstance, _data: CodeMirror.EditorChange, value: string) {
        this.props.onChange(value);
    }

    render() {
        return (
            <ReactCodeMirror
                ref={this.codeMirrorRef.bind(this)}
                onChange={this.handleEditorChange.bind(this)}
                options={this.options}
                value={this.props.value} />
        );
    }
}
