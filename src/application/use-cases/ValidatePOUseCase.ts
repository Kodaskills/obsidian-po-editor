import type { POFile } from '../../domain/entities/POFile';
import type { POEntry, POFlag } from '../../domain/entities/POEntry';

export interface ValidationError {
    type: 'error' | 'warning';
    message: string;
    entry?: string;
    line?: number;
}

export interface ValidatePOUseCaseInput {
    poFile: POFile;
    strictMode?: boolean;
}

export interface ValidatePOUseCaseOutput {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
    statistics: {
        total: number;
        translated: number;
        untranslated: number;
        fuzzy: number;
    };
}

export class ValidatePOUseCase {
    execute(input: ValidatePOUseCaseInput): ValidatePOUseCaseOutput {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const strictMode = input.strictMode ?? false;
        
        if (!input.poFile) {
            return {
                valid: false,
                errors: [{ type: 'error', message: 'PO file is required' }],
                warnings: [],
                statistics: { total: 0, translated: 0, untranslated: 0, fuzzy: 0 },
            };
        }
        
        const stats = {
            total: input.poFile.entries.length,
            translated: 0,
            untranslated: 0,
            fuzzy: 0,
        };
        
        for (const entry of input.poFile.entries) {
            this.validateEntry(entry, errors, warnings, strictMode);
            
            if (entry.msgstr.trim()) {
                stats.translated++;
            } else {
                stats.untranslated++;
            }
            
            if (entry.flags.includes('fuzzy')) {
                stats.fuzzy++;
            }
        }
        
        for (const entry of input.poFile.obsolete) {
            warnings.push({
                type: 'warning',
                message: 'Obsolete entry found',
                entry: entry.msgid,
            });
        }
        
        if (strictMode && stats.untranslated > 0) {
            errors.push({
                type: 'error',
                message: `${stats.untranslated} untranslated entries found in strict mode`,
            });
        }
        
        if (stats.fuzzy > 0) {
            warnings.push({
                type: 'warning',
                message: `${stats.fuzzy} fuzzy entries found`,
            });
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            statistics: stats,
        };
    }
    
    private validateEntry(
        entry: POEntry,
        errors: ValidationError[],
        warnings: ValidationError[],
        strictMode: boolean
    ): void {
        if (entry.msgid === '' && entry.msgstr !== '') {
            errors.push({
                type: 'error',
                message: 'Empty msgid with non-empty msgstr',
                entry: entry.msgstr.substring(0, 50),
            });
            return;
        }
        
        if (entry.msgid === '' && entry.msgstr === '' && !entry.msgidPlural) {
            if (strictMode) {
                errors.push({
                    type: 'error',
                    message: 'Entry has empty msgid and msgstr',
                });
            }
            return;
        }
        
        if (entry.msgidPlural && !entry.msgstrPlural) {
            errors.push({
                type: 'error',
                message: 'Plural form defined but msgstr plural is missing',
                entry: entry.msgid,
            });
        }
        
        if (!entry.msgidPlural && entry.msgstrPlural && entry.msgstrPlural.length > 1) {
            errors.push({
                type: 'error',
                message: 'Non-plural entry has multiple msgstr forms',
                entry: entry.msgid,
            });
        }
        
        if (entry.msgidPlural && entry.msgstrPlural && entry.msgstrPlural.length === 0) {
            errors.push({
                type: 'error',
                message: 'Plural entry has empty msgstr array',
                entry: entry.msgid,
            });
        }
        
        const hasFuzzy = entry.flags.includes('fuzzy');
        const hasTranslated = entry.msgstr.trim().length > 0;
        
        if (hasFuzzy && hasTranslated && strictMode) {
            warnings.push({
                type: 'warning',
                message: 'Fuzzy entry has translation',
                entry: entry.msgid,
            });
        }
        
        if (!hasFuzzy && !hasTranslated && entry.msgid !== '' && !entry.msgidPlural) {
            warnings.push({
                type: 'warning',
                message: 'Untranslated entry',
                entry: entry.msgid,
            });
        }
        
        this.validateFlags(entry, warnings);
    }
    
    private validateFlags(entry: POEntry, warnings: ValidationError[]): void {
        const flags = entry.flags;
        
        const hasCFormat = flags.includes('c-format');
        const hasNoCFormat = flags.includes('no-c-format');
        const hasPythonFormat = flags.includes('python-format');
        const hasPythonBraceFormat = flags.includes('python-brace-format');
        const hasCsharpFormat = flags.includes('csharp-format');
        
        if (hasCFormat && hasNoCFormat) {
            warnings.push({
                type: 'warning',
                message: 'Conflicting format flags: c-format and no-c-format',
                entry: entry.msgid,
            });
        }
        
        if ([hasPythonFormat, hasPythonBraceFormat, hasCsharpFormat].filter(Boolean).length > 1) {
            warnings.push({
                type: 'warning',
                message: 'Multiple format flags specified',
                entry: entry.msgid,
            });
        }
    }
}

export function formatValidationResult(result: ValidatePOUseCaseOutput): string {
    const lines: string[] = [];
    
    if (result.valid) {
        lines.push('✓ PO file is valid');
    } else {
        lines.push('✗ PO file has errors');
    }
    
    lines.push('');
    lines.push(`Total entries: ${result.statistics.total}`);
    lines.push(`Translated: ${result.statistics.translated}`);
    lines.push(`Untranslated: ${result.statistics.untranslated}`);
    lines.push(`Fuzzy: ${result.statistics.fuzzy}`);
    
    if (result.errors.length > 0) {
        lines.push('');
        lines.push('Errors:');
        for (const error of result.errors) {
            const entry = error.entry ? `: "${error.entry}"` : '';
            lines.push(`  • ${error.message}${entry}`);
        }
    }
    
    if (result.warnings.length > 0) {
        lines.push('');
        lines.push('Warnings:');
        for (const warning of result.warnings) {
            const entry = warning.entry ? `: "${warning.entry}"` : '';
            lines.push(`  • ${warning.message}${entry}`);
        }
    }
    
    return lines.join('\n');
}