using System.Windows;
using ICSharpCode.AvalonEdit;

namespace SvnClient.App.Behaviors;

/// <summary>
/// AvalonEdit's TextEditor.Document.Text isn't a bindable dependency property, so this
/// attached property bridges MVVM text bindings to the editor without a code-behind
/// event handler in every view that hosts it.
/// </summary>
public static class AvalonEditBehavior
{
    public static readonly DependencyProperty BindableTextProperty = DependencyProperty.RegisterAttached(
        "BindableText",
        typeof(string),
        typeof(AvalonEditBehavior),
        new FrameworkPropertyMetadata(string.Empty, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, OnBindableTextChanged));

    public static string GetBindableText(DependencyObject obj) => (string)obj.GetValue(BindableTextProperty);
    public static void SetBindableText(DependencyObject obj, string value) => obj.SetValue(BindableTextProperty, value);

    private static void OnBindableTextChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not TextEditor editor) return;

        var newText = e.NewValue as string ?? "";
        if (editor.Text != newText)
        {
            editor.Text = newText;
        }

        // Avoid stacking multiple handlers if the property is set repeatedly.
        editor.TextChanged -= EditorOnTextChanged;
        editor.TextChanged += EditorOnTextChanged;
    }

    private static void EditorOnTextChanged(object? sender, EventArgs e)
    {
        if (sender is not TextEditor editor) return;
        SetBindableText(editor, editor.Text);
    }
}
